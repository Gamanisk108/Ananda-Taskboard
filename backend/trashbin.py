"""Trash: cascade soft-delete, restore, listing, and purge for Projects,
Sub-projects, and Tasks. Deleting a Project/Sub-project cascades to its children
using one shared timestamp, so a restore brings back exactly what was removed
together. Items older than RETENTION_DAYS are purged for good.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.engine import is_org_admin
from projects.models import Project, SubProject
from tasks.models import Task

RETENTION_DAYS = 7


# --- cascade soft-delete ----------------------------------------------------

def soft_delete_task(task, by=None):
    if by is not None:
        task.deleted_by = by
    task.delete()  # soft


def soft_delete_subproject(subproject, ts=None, by=None):
    ts = ts or timezone.now()
    Task.objects.filter(subproject=subproject).update(deleted_at=ts, deleted_by=by)  # live tasks → trashed
    SubProject.all_objects.filter(pk=subproject.pk).update(deleted_at=ts)


def soft_delete_project(project, ts=None, by=None):
    ts = ts or timezone.now()
    Task.objects.filter(subproject__project=project).update(deleted_at=ts, deleted_by=by)
    SubProject.objects.filter(project=project).update(deleted_at=ts)
    Project.all_objects.filter(pk=project.pk).update(deleted_at=ts)


# --- restore (matches the cascade timestamp) --------------------------------

def restore_task(task):
    task.restore()


def restore_subproject(subproject):
    ts = subproject.deleted_at
    SubProject.all_objects.filter(pk=subproject.pk).update(deleted_at=None)
    if ts:
        Task.all_objects.filter(subproject=subproject, deleted_at=ts).update(deleted_at=None, deleted_by=None)


def restore_project(project):
    ts = project.deleted_at
    Project.all_objects.filter(pk=project.pk).update(deleted_at=None)
    if ts:
        SubProject.all_objects.filter(project=project, deleted_at=ts).update(deleted_at=None)
        Task.all_objects.filter(subproject__project=project, deleted_at=ts).update(deleted_at=None, deleted_by=None)


# --- purge ------------------------------------------------------------------

def purge_expired():
    cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
    # QuerySet.delete() is a real DB delete (model.delete() is the soft one).
    counts = {
        "tasks": Task.all_objects.filter(deleted_at__lt=cutoff).delete()[0],
        "subprojects": SubProject.all_objects.filter(deleted_at__lt=cutoff).delete()[0],
        "projects": Project.all_objects.filter(deleted_at__lt=cutoff).delete()[0],
    }
    return counts


# --- API ---------------------------------------------------------------------
# Org-scoped. Admins (of the active org) manage all that org's trash. Non-admins
# only ever delete Tasks (project/sub-project deletion is admin-only), so they
# see and restore ONLY the tasks they themselves deleted — never another user's,
# never projects/sub-projects, and never anything outside the active org.

def _org(request):
    return getattr(request, "org", None)


def _org_id_of(obj, kind):
    if kind == "task":
        return obj.subproject.project.organization_id
    if kind == "subproject":
        return obj.project.organization_id
    return obj.organization_id  # project


def _days_left(deleted_at):
    if not deleted_at:
        return None
    import math

    gone = deleted_at + timedelta(days=RETENTION_DAYS)
    secs = (gone - timezone.now()).total_seconds()
    return max(0, math.ceil(secs / 86400))


class TrashView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = _org(request)

        def row(obj, label):
            return {"id": obj.id, "label": label, "deleted_at": obj.deleted_at, "days_left": _days_left(obj.deleted_at)}

        if is_org_admin(request.user, org):
            projects = Project.all_objects.dead()
            subs = SubProject.all_objects.dead().select_related("project")
            tasks = Task.all_objects.dead()
            if org is not None:  # tenant isolation: only this org's trash
                projects = projects.filter(organization=org)
                subs = subs.filter(project__organization=org)
                tasks = tasks.filter(subproject__project__organization=org)
            return Response({
                "projects": [row(p, p.name) for p in projects],
                "subprojects": [row(s, f"{s.project.name} / {s.name}") for s in subs],
                "tasks": [row(t, t.title) for t in tasks],
            })

        own = Task.all_objects.dead().filter(deleted_by=request.user)
        if org is not None:
            own = own.filter(subproject__project__organization=org)
        return Response({
            "projects": [],
            "subprojects": [],
            "tasks": [row(t, t.title) for t in own.select_related("subproject__project")],
        })


class TrashActionView(APIView):
    permission_classes = [IsAuthenticated]

    MODELS = {"project": Project, "subproject": SubProject, "task": Task}

    def _get(self, request, kind, pk):
        model = self.MODELS.get(kind)
        if not model:
            raise ValidationError({"type": "Must be project, subproject, or task."})
        obj = model.all_objects.filter(pk=pk).first()
        if not obj:
            raise ValidationError({"id": "Not found."})
        org = _org(request)
        # Tenant isolation: the item must belong to the active org.
        if org is not None and _org_id_of(obj, kind) != org.id:
            raise PermissionDenied("Not found in this organization.")
        # Non-admins may only act on a Task they personally deleted.
        if not is_org_admin(request.user, org) and (
            kind != "task" or getattr(obj, "deleted_by_id", None) != request.user.id
        ):
            raise PermissionDenied("You can only restore items you deleted.")
        return obj

    def post(self, request):  # restore
        obj = self._get(request, request.data.get("type"), request.data.get("id"))
        {"project": restore_project, "subproject": restore_subproject, "task": restore_task}[request.data["type"]](obj)
        return Response({"restored": request.data["type"], "id": obj.id})

    def delete(self, request):  # purge one forever
        obj = self._get(request, request.data.get("type"), request.data.get("id"))
        obj.hard_delete()
        return Response(status=204)
