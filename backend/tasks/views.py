from django.db import transaction
from rest_framework import status as http
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from events import emit
from permissions.drf import IsAdmin
from permissions.engine import can_act_as_member, visible_subproject_ids
from projects.models import SubProject

from .models import Task
from .serializers import TaskSerializer


def _approval_for(user, subproject):
    """Decide a Member's task approval state. Admin or a trusted sub-project →
    live (approved); otherwise pending."""
    if user.is_admin or subproject.members_post_without_approval:
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
        qs = Task.objects.select_related("subproject", "recurrence_rule").prefetch_related("assignees")
        if not user.is_admin:
            qs = qs.filter(subproject_id__in=visible_subproject_ids(user))
        # The live board shows only approved tasks; pending/rejected live in the
        # approvals inbox. Admins/creators can opt in via ?approval=.
        approval = self.request.query_params.get("approval")
        if approval in dict(Task.Approval.choices):
            qs = qs.filter(approval_state=approval)
        elif self.action == "list":
            qs = qs.filter(approval_state=Task.Approval.APPROVED)
        params = self.request.query_params
        if params.get("subproject"):
            qs = qs.filter(subproject_id=params["subproject"])
        if params.get("project"):
            qs = qs.filter(subproject__project_id=params["project"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        if params.get("member"):
            qs = qs.filter(assignees__id=params["member"])
        return qs.distinct()

    def _require_visible_subproject(self, subproject_id):
        sp = SubProject.objects.filter(pk=subproject_id).first()
        if sp is None:
            raise ValidationError({"subproject": "Sub-project does not exist."})
        user = self.request.user
        if not user.is_admin and sp.id not in visible_subproject_ids(user):
            raise PermissionDenied("You do not have access to that sub-project.")
        return sp

    def perform_create(self, serializer):
        sp = self._require_visible_subproject(serializer.validated_data["subproject"].id)
        if not can_act_as_member(self.request.user, sp.id):
            raise PermissionDenied("Viewers cannot create tasks.")
        approval = _approval_for(self.request.user, sp)
        task = serializer.save(created_by=self.request.user, approval_state=approval)
        emit.emit(emit.TASK_CREATED, {"task": task.id, "approval": approval})

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        target_sp_id = serializer.validated_data.get("subproject", instance.subproject).id
        sp = self._require_visible_subproject(target_sp_id)
        if not can_act_as_member(user, sp.id):
            raise PermissionDenied("Viewers cannot edit tasks.")
        task = serializer.save()
        # A Member's content edit re-enters approval unless the sub-project is
        # trusted; Admin edits stay live.
        if not user.is_admin and not sp.members_post_without_approval:
            Task.objects.filter(pk=task.pk).update(approval_state=Task.Approval.PENDING)
            task.refresh_from_db()
        emit.emit(emit.TASK_UPDATED, {"task": task.id})

    def perform_destroy(self, instance):
        if not (self.request.user.is_admin or can_act_as_member(self.request.user, instance.subproject_id)):
            raise PermissionDenied("Not allowed.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        """Change status. Assignees of the task or Admins only — direct, no approval."""
        task = self.get_object()  # 404 if not visible
        user = request.user
        if not (user.is_admin or task.assignees.filter(pk=user.pk).exists()):
            raise PermissionDenied("Only assignees or admins can change status.")
        new_status = request.data.get("status")
        if new_status not in dict(Task.Status.choices):
            raise ValidationError({"status": "Invalid status."})
        with transaction.atomic():
            locked = Task.objects.select_for_update().get(pk=task.pk)
            changed = locked.status != new_status
            locked.status = new_status
            locked.save(update_fields=["status", "updated_at"])
        if changed:
            emit.emit(emit.TASK_STATUS_CHANGED, {"task": task.id, "status": new_status})
        return Response({"id": task.id, "status": new_status})

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


class ApprovalsView(APIView):
    """Admin approvals inbox: pending tasks, with a bulk approve/reject action."""

    permission_classes = [IsAdmin]

    def get(self, request):
        pending = (
            Task.objects.filter(approval_state=Task.Approval.PENDING)
            .select_related("subproject", "created_by")
            .order_by("created_at")
        )
        return Response(TaskSerializer(pending, many=True).data)

    def post(self, request):
        ids = request.data.get("ids", [])
        act = request.data.get("action")
        if act not in ("approve", "reject"):
            raise ValidationError({"action": "Must be 'approve' or 'reject'."})
        target = Task.Approval.APPROVED if act == "approve" else Task.Approval.REJECTED
        event = emit.TASK_APPROVED if act == "approve" else emit.TASK_REJECTED
        updated = []
        with transaction.atomic():
            for task in Task.objects.select_for_update().filter(pk__in=ids):
                if task.approval_state != target:
                    task.approval_state = target
                    task.save(update_fields=["approval_state", "updated_at"])
                    emit.emit(event, {"task": task.id})
                updated.append(task.id)
        return Response({"updated": updated, "action": act})
