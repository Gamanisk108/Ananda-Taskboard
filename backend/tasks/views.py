from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from events import emit
from permissions.drf import IsAdmin
from permissions.engine import (
    can_act_as_member,
    can_see_task,
    is_org_admin,
    visible_subproject_ids,
    visible_tasks_q,
)
from projects.models import SubProject


def _org(request):
    """The active organization for this request (set by OrgContextMiddleware)."""
    return getattr(request, "org", None)


def _csv_ids(raw):
    """Parse a comma-separated list of ids ("3,7,12") into [int]; [] when blank or
    malformed. Supports the multi-select assignee/group filters."""
    if not raw:
        return []
    out = []
    for part in str(raw).split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out

from .models import Comment, Subtask, Task
from .serializers import CommentSerializer, SubtaskSerializer, TaskSerializer


def _notify_admins_moved(task, new_status, mover):
    """Push to all admins that a monitored task was moved (best-effort, never raises)."""
    try:
        from accounts.models import Membership
        from notifications.models import PushSubscription
        from notifications.push import send_web_push_async

        payload = {
            "title": "Task moved",
            "body": f"{mover.name or mover.email} moved “{task.title}” → {new_status}",
        }
        # Notify admins of the task's own org only (tenant-scoped).
        admin_ids = Membership.objects.filter(
            organization_id=task.subproject.project.organization_id,
            role=Membership.Role.ADMIN, is_active=True,
        ).values_list("user_id", flat=True)
        for sub in PushSubscription.objects.filter(user_id__in=admin_ids):
            send_web_push_async(sub, payload)
    except Exception:
        pass


def _notify_mentioned(task, author, user_ids):
    """Push to users @-mentioned in a comment (best-effort, never raises)."""
    try:
        from notifications.models import PushSubscription
        from notifications.push import send_web_push_async

        targets = [uid for uid in user_ids if uid != author.id]
        if not targets:
            return
        payload = {
            "title": "You were mentioned",
            "body": f"{author.name or author.email} mentioned you on “{task.title}”",
        }
        for sub in PushSubscription.objects.filter(user_id__in=targets):
            send_web_push_async(sub, payload)
    except Exception:
        pass


def _notify_assigned(task, actor, new_user_ids):
    """Push to users newly assigned to a task who opted into assignment-change
    notifications (best-effort, never raises). The actor isn't pinged for their
    own action."""
    try:
        from accounts.models import User
        from notifications.models import PushSubscription
        from notifications.push import send_web_push_async

        targets = list(
            User.objects.filter(id__in=new_user_ids, assignment_changes=True)
            .exclude(id=actor.id)
            .values_list("id", flat=True)
        )
        if not targets:
            return
        payload = {
            "title": "New assignment",
            "body": f"{actor.name or actor.email} assigned you “{task.title}”",
        }
        for sub in PushSubscription.objects.filter(user_id__in=targets):
            send_web_push_async(sub, payload)
    except Exception:
        pass


def _approval_for(user, subproject, org):
    """Decide a Member's task approval state. Admin or a trusted sub-project →
    live (approved); otherwise pending."""
    if is_org_admin(user, org) or subproject.members_post_without_approval:
        return Task.Approval.APPROVED
    return Task.Approval.PENDING


class TaskViewSet(ModelViewSet):
    """Tasks, with server-side authorization on every operation.

    Visibility, create/edit approval, and status changes are all enforced here
    regardless of what the UI exposes. A task in a hidden sub-project is simply
    not in the queryset → 404 (IDOR-safe, never leaks data)."""

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org = _org(self.request)
        qs = (
            Task.objects.select_related("subproject", "recurrence_rule")
            .prefetch_related("assignees", "subtasks")
            .annotate(comment_count_anno=Count("comments", distinct=True))
        )
        # Always go through the engine — it scopes admins to their org and members
        # to their grants. (Skipping it for admins leaked every org's tasks.)
        qs = qs.filter(visible_tasks_q(user, org))
        # The live board shows approved tasks PLUS the requester's own pending
        # submissions (D50/APR-4: a member's task never silently vanishes while
        # it awaits approval — the UI renders it read-only with a pending pill).
        # Rejected tasks and other people's pending stay in the approvals inbox.
        # Admins/creators can still opt in via ?approval=.
        approval = self.request.query_params.get("approval")
        if approval in dict(Task.Approval.choices):
            qs = qs.filter(approval_state=approval)
        elif self.action == "list":
            qs = qs.filter(
                Q(approval_state=Task.Approval.APPROVED)
                | Q(approval_state=Task.Approval.PENDING, created_by=user)
            )
        params = self.request.query_params
        # Archive: list hides archived by default; ?archived=1 shows only archived.
        if self.action == "list":
            if params.get("archived") in ("1", "true"):
                qs = qs.filter(archived_at__isnull=False)
            else:
                qs = qs.filter(archived_at__isnull=True)
        if params.get("subproject"):
            qs = qs.filter(subproject_id=params["subproject"])
        if params.get("project"):
            qs = qs.filter(subproject__project_id=params["project"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        # Assignee filter — multi-select with OR semantics across: any of the chosen
        # people, members of any chosen group, tasks assigned directly to a chosen
        # group, and/or unassigned tasks. Group member-expansion stays server-side so
        # membership is never exposed to the client. Accepts comma-separated ids
        # (and the legacy single-id form).
        people = _csv_ids(params.get("member"))
        group_ids = _csv_ids(params.get("assignee_group"))
        want_unassigned = params.get("unassigned") in ("1", "true")
        if people or group_ids or want_unassigned:
            cond = Q()
            if people:
                cond |= Q(assignees__id__in=people)
            if group_ids:
                from accounts.models import Group
                member_ids = list(
                    Group.objects.filter(id__in=group_ids).values_list("members__id", flat=True)
                )
                cond |= Q(assignee_groups__id__in=group_ids) | Q(assignees__id__in=member_ids)
            if want_unassigned:
                cond |= Q(assignees__isnull=True)
            qs = qs.filter(cond)
        return qs.distinct()

    def _require_visible_subproject(self, subproject_id):
        sp = SubProject.objects.filter(pk=subproject_id).first()
        if sp is None:
            raise ValidationError({"subproject": "Sub-project does not exist."})
        user = self.request.user
        org = _org(self.request)
        # visible_subproject_ids is org-scoped for admins too, so this also stops an
        # admin from reaching another org's sub-project by id.
        if sp.id not in visible_subproject_ids(user, org):
            raise PermissionDenied("You do not have access to that sub-project.")
        return sp

    def perform_create(self, serializer):
        org = _org(self.request)
        sp = self._require_visible_subproject(serializer.validated_data["subproject"].id)
        if not can_act_as_member(self.request.user, sp.id, org):
            raise PermissionDenied("Viewers cannot create tasks.")
        approval = _approval_for(self.request.user, sp, org)
        task = serializer.save(created_by=self.request.user, approval_state=approval)
        assigned_ids = set(task.assignees.values_list("id", flat=True))
        if assigned_ids:
            _notify_assigned(task, self.request.user, assigned_ids)
        emit.emit(emit.TASK_CREATED, {"task": task.id, "approval": approval})

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        org = _org(self.request)
        target_sp_id = serializer.validated_data.get("subproject", instance.subproject).id
        sp = self._require_visible_subproject(target_sp_id)
        if not can_act_as_member(user, sp.id, org):
            raise PermissionDenied("Viewers cannot edit tasks.")
        before_assignees = set(instance.assignees.values_list("id", flat=True))
        task = serializer.save()
        newly_assigned = set(task.assignees.values_list("id", flat=True)) - before_assignees
        if newly_assigned:
            _notify_assigned(task, user, newly_assigned)
        # A Member's content edit re-enters approval unless the sub-project is
        # trusted; Admin edits stay live.
        if not is_org_admin(user, org) and not sp.members_post_without_approval:
            Task.objects.filter(pk=task.pk).update(approval_state=Task.Approval.PENDING)
            task.refresh_from_db()
        emit.emit(emit.TASK_UPDATED, {"task": task.id})

    def perform_destroy(self, instance):
        org = _org(self.request)
        if not (is_org_admin(self.request.user, org) or can_act_as_member(self.request.user, instance.subproject_id, org)):
            raise PermissionDenied("Not allowed.")
        instance.deleted_by = self.request.user  # for self-service Trash restore
        instance.delete()

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        """Change status. Assignees of the task or Admins only — direct, no approval."""
        task = self.get_object()  # 404 if not visible
        user = request.user
        if not (is_org_admin(user, _org(request)) or task.assignees.filter(pk=user.pk).exists()):
            raise PermissionDenied("Only assignees or admins can change status.")
        from .models import Status

        new_status = request.data.get("status")
        if not Status.objects.filter(key=new_status).exists():
            raise ValidationError({"status": "Invalid status."})
        with transaction.atomic():
            locked = Task.objects.select_for_update().get(pk=task.pk)
            changed = locked.status != new_status
            locked.status = new_status
            locked.save(update_fields=["status", "updated_at"])
        if changed:
            emit.emit(emit.TASK_STATUS_CHANGED, {"task": task.id, "status": new_status})
            if task.monitor:
                _notify_admins_moved(task, new_status, user)
        return Response({"id": task.id, "status": new_status})

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        """Recover an archived task back onto the board."""
        task = self.get_object()
        org = _org(request)
        if not (is_org_admin(request.user, org) or can_act_as_member(request.user, task.subproject_id, org)):
            raise PermissionDenied("Not allowed.")
        Task.objects.filter(pk=task.pk).update(archived_at=None)
        return Response({"id": task.id, "archived_at": None})

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        """Any user with visibility to the task may read and add comments."""
        task = self.get_object()  # 404 if not visible
        if request.method == "GET":
            return Response(CommentSerializer(task.comments.all(), many=True).data)
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "Comment cannot be empty."})
        comment = Comment.objects.create(task=task, author=request.user, text=text)
        # @-mentions: client sends the picked user ids; we store + push-notify them.
        from accounts.models import User

        raw = request.data.get("mentions") or []
        # Only mention users who can actually see this task (don't leak its title
        # via a push to someone without access — respects "own" + exclusions).
        mention_ids = [
            u.id for u in User.objects.filter(id__in=raw)
            if can_see_task(u, task, _org(request))
        ]
        if mention_ids:
            comment.mentions.set(mention_ids)
            _notify_mentioned(task, request.user, mention_ids)
        emit.emit(emit.COMMENT_ADDED, {"task": task.id, "comment": comment.id})
        return Response(CommentSerializer(comment).data, status=http.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        return self._set_approval(pk, Task.Approval.APPROVED, emit.TASK_APPROVED)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        return self._set_approval(pk, Task.Approval.REJECTED, emit.TASK_REJECTED)

    def _set_approval(self, pk, target, event):
        """Idempotent, race-safe approve/reject (resolves double-approve to one)."""
        with transaction.atomic():
            task = Task.objects.select_for_update().filter(pk=pk).first()
            if task is None:
                return Response(status=http.HTTP_404_NOT_FOUND)
            changed = task.approval_state != target
            if changed:
                task.approval_state = target
                task.save(update_fields=["approval_state", "updated_at"])
        if changed:
            emit.emit(event, {"task": int(pk)})
        return Response({"id": int(pk), "approval_state": target})


class CommentViewSet(ModelViewSet):
    """Edit/delete a comment. Author or admin only. (Listing & creation happen
    through the task's `comments` action.)"""

    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["patch", "delete", "options"]

    def get_queryset(self):
        user = self.request.user
        org = _org(self.request)
        qs = Comment.objects.select_related("task__subproject", "author")
        return qs.filter(visible_tasks_q(user, org, prefix="task__")).distinct()

    def _check(self, comment):
        if not (is_org_admin(self.request.user, _org(self.request)) or comment.author_id == self.request.user.id):
            raise PermissionDenied("Only the comment's author or an admin can do that.")

    def perform_update(self, serializer):
        self._check(serializer.instance)
        serializer.save()  # task is set on create; PATCH only carries text

    def perform_destroy(self, instance):
        self._check(instance)
        instance.delete()


class SubtaskViewSet(ModelViewSet):
    """Checklist items under a task. Anyone who can act as a member on the
    parent task's sub-project may add/edit/remove them (admins always)."""

    serializer_class = SubtaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        org = _org(self.request)
        qs = Subtask.objects.select_related("task__subproject")
        qs = qs.filter(visible_tasks_q(user, org, prefix="task__")).distinct()
        task = self.request.query_params.get("task")
        if task:
            qs = qs.filter(task_id=task)
        return qs

    def _check(self, task):
        org = _org(self.request)
        if not (is_org_admin(self.request.user, org) or can_act_as_member(self.request.user, task.subproject_id, org)):
            raise PermissionDenied("Not allowed.")

    def perform_create(self, serializer):
        self._check(serializer.validated_data["task"])
        serializer.save()

    def perform_update(self, serializer):
        # An assignee of the subtask — directly, or via an assigned group — may edit
        # it (it's already visible to them via the queryset); otherwise the
        # parent-task member/admin rule applies.
        sub = serializer.instance
        user = self.request.user
        is_assignee = sub.assignees.filter(id=user.id).exists() or sub.assignee_groups.filter(members=user).exists()
        if not is_assignee:
            self._check(sub.task)
        new_task = serializer.validated_data.get("task")
        if new_task and new_task.id != sub.task_id:
            raise ValidationError({"task": "A subtask cannot be moved to a different task."})
        serializer.save()

    def perform_destroy(self, instance):
        self._check(instance.task)
        instance.delete()


class MyPendingApprovalsView(APIView):
    """D50/APR-4: the signed-in member's OWN tasks awaiting admin approval —
    powers the 'Pending approval' menu badge and the 'Waiting for approval'
    list. Any authenticated user; scoped to their submissions in the org."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = _org(request)
        mine = (
            Task.objects.filter(approval_state=Task.Approval.PENDING, created_by=request.user)
            .filter(visible_tasks_q(request.user, org))
            .select_related("subproject", "created_by")
            .prefetch_related("assignees", "subtasks")
            .order_by("-created_at")
            .distinct()
        )
        return Response(TaskSerializer(mine, many=True).data)


class ApprovalsView(APIView):
    """Admin approvals inbox: pending tasks, with a bulk approve/reject action."""

    permission_classes = [IsAdmin]

    def get(self, request):
        org = _org(request)
        pending = (
            Task.objects.filter(approval_state=Task.Approval.PENDING)
            .filter(visible_tasks_q(request.user, org))  # org-scoped (no cross-org leak)
            .select_related("subproject", "created_by")
            .prefetch_related("assignees", "subtasks")
            .order_by("created_at")
            .distinct()
        )
        return Response(TaskSerializer(pending, many=True).data)

    def post(self, request):
        ids = request.data.get("ids", [])
        act = request.data.get("action")
        if act not in ("approve", "reject"):
            raise ValidationError({"action": "Must be 'approve' or 'reject'."})
        target = Task.Approval.APPROVED if act == "approve" else Task.Approval.REJECTED
        event = emit.TASK_APPROVED if act == "approve" else emit.TASK_REJECTED
        # Restrict the targets to tasks visible in the active org — an admin can't
        # approve another org's task by passing its id.
        scoped_ids = set(
            Task.objects.filter(pk__in=ids).filter(visible_tasks_q(request.user, _org(request)))
            .values_list("pk", flat=True)
        )
        updated = []
        with transaction.atomic():
            for task in Task.objects.select_for_update().filter(pk__in=scoped_ids):
                if task.approval_state != target:
                    task.approval_state = target
                    task.save(update_fields=["approval_state", "updated_at"])
                    emit.emit(event, {"task": task.id})
                updated.append(task.id)
        return Response({"updated": updated, "action": act})
