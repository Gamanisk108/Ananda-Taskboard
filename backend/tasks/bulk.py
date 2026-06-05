"""Bulk operations: transition many tasks at once (move / assign / status /
deadline / archive), and mark a whole Project or Sub-project Done + archived.

Admins may run every action on any task. Members may run the SAFE SUBSET
(status / deadline) and only on tasks they have member-level (edit) access to;
tasks they can't edit are silently skipped and reported back as `skipped`.
The destructive/cross-boundary actions (move / assign / archive) and MarkDone
stay admin-only."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdmin
from permissions.engine import can_act_as_member
from permissions.models import audit
from projects.models import SubProject

from .models import Status, Task

# Actions a non-admin Member is allowed to bulk-apply (safe, in-place edits only).
MEMBER_ACTIONS = {"status", "deadline"}


def _complete_status_key():
    return (Status.objects.filter(is_complete=True).values_list("key", flat=True).first()) or "done"


class BulkTasksView(APIView):
    """POST {ids:[...], action, value}. action ∈ move|assign|status|deadline|archive.
    Members are limited to status/deadline on tasks they can edit; applied in one
    transaction. Returns {updated, skipped}."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids") or []
        action = request.data.get("action")
        value = request.data.get("value")
        user = request.user
        skipped = 0
        if not user.is_admin:
            if action not in MEMBER_ACTIONS:
                raise PermissionDenied("Members can only bulk-change status or deadline.")
            # Scope to tasks the member may edit; silently skip the rest.
            requested = list(Task.objects.filter(id__in=ids).values_list("id", "subproject_id"))
            allowed_ids = [tid for tid, sp_id in requested if can_act_as_member(user, sp_id)]
            skipped = len(requested) - len(allowed_ids)
            ids = allowed_ids
        qs = Task.objects.filter(id__in=ids)
        now = timezone.now()
        n = 0
        with transaction.atomic():
            if action == "move":
                sp = SubProject.objects.filter(pk=value).first()
                if not sp:
                    raise ValidationError({"value": "Sub-project not found."})
                n = qs.update(subproject=sp, updated_at=now)
                summary = f"moved {n} task(s) → {sp.project.name} / {sp.name}"
            elif action == "status":
                if not Status.objects.filter(key=value).exists():
                    raise ValidationError({"value": "Unknown status."})
                n = qs.update(status=value, updated_at=now)
                summary = f"set {n} task(s) → status '{value}'"
            elif action == "deadline":
                n = qs.update(deadline=value or None, updated_at=now)
                summary = f"set deadline on {n} task(s) → {value or 'none'}"
            elif action == "assign":
                user_ids = value or []
                tasks = list(qs)
                for t in tasks:
                    t.assignees.set(user_ids)
                n = len(tasks)
                summary = f"reassigned {n} task(s) → {len(user_ids)} assignee(s)"
            elif action == "archive":
                n = qs.update(archived_at=now, updated_at=now)
                summary = f"archived {n} task(s)"
            else:
                raise ValidationError({"action": "Unknown bulk action."})
        audit(request.user, f"bulk.{action}", f"Bulk: {summary}")
        return Response({"updated": n, "skipped": skipped})


class MarkDoneView(APIView):
    """Mark every (non-archived) task in a Project or Sub-project Done + archived."""

    permission_classes = [IsAdmin]

    def post(self, request, kind, pk):
        if kind not in ("project", "subproject"):
            raise ValidationError({"kind": "Must be project or subproject."})
        done = _complete_status_key()
        now = timezone.now()
        flt = {"subproject__project_id": pk} if kind == "project" else {"subproject_id": pk}
        qs = Task.objects.filter(archived_at__isnull=True, **flt)
        n = qs.update(status=done, archived_at=now, updated_at=now)
        audit(request.user, "bulk.markDone", f"Marked {kind} #{pk} Done + archived {n} task(s)")
        return Response({"updated": n})
