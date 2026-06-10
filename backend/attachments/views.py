"""Media attachment endpoints (Cloudflare R2, presigned direct upload).

Flow: client asks to `presign` (we validate caps + permission, hand back a
presigned PUT url + object key) → client PUTs the (already client-compressed)
file straight to R2 → client `confirm`s (we HEAD-validate the object and create
the row). Serving goes through `/<id>/file` which permission-checks then 302s to
a short-lived presigned GET (the bucket stays private).
"""
import re
import uuid

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes as perm
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from feedback.models import ProblemReport
from permissions.engine import can_act_as_member, can_see_task, is_org_admin
from tasks.models import Subtask, Task

from . import r2
from .models import Attachment
from .serializers import AttachmentSerializer

KIND_BY_PREFIX = {"image/": "image", "video/": "video"}
DOC_TYPES = {
    "application/pdf", "text/plain", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _org(request):
    return getattr(request, "org", None)


def _kind_for(content_type: str) -> str:
    for prefix, kind in KIND_BY_PREFIX.items():
        if content_type.startswith(prefix):
            return kind
    if content_type in DOC_TYPES:
        return "doc"
    return ""


def _max_bytes(kind: str) -> int:
    return {"image": settings.ATTACH_MAX_IMAGE, "doc": settings.ATTACH_MAX_DOC,
            "video": settings.ATTACH_MAX_VIDEO}.get(kind, 0)


def _resolve_target(request, write: bool):
    """Resolve the (target-kwargs, count-queryset) for the requested target, after
    permission-checking. `write` = create/delete vs view."""
    data = request.data if request.method in ("POST", "DELETE") else request.query_params
    user, org = request.user, _org(request)

    if data.get("task"):
        task = get_object_or_404(Task, pk=data["task"])
        if write:
            if not can_act_as_member(user, task.subproject_id, org):
                raise PermissionDenied("You can't attach files to this task.")
        elif not can_see_task(user, task, org):
            raise PermissionDenied("Not allowed.")
        return {"task": task}, Attachment.objects.filter(task=task)

    if data.get("subtask"):
        st = get_object_or_404(Subtask.objects.select_related("task"), pk=data["subtask"])
        if write:
            if not can_act_as_member(user, st.task.subproject_id, org):
                raise PermissionDenied("You can't attach files to this subtask.")
        elif not can_see_task(user, st.task, org):
            raise PermissionDenied("Not allowed.")
        return {"subtask": st}, Attachment.objects.filter(subtask=st)

    if data.get("report"):
        rep = get_object_or_404(ProblemReport, pk=data["report"])
        if not (rep.user_id == user.id or user.is_superuser):
            raise PermissionDenied("Not allowed.")
        return {"report": rep}, Attachment.objects.filter(report=rep)

    raise ValidationError({"target": "Provide a task, subtask, or report id."})


def _safe_name(name: str) -> str:
    name = (name or "file").strip().replace("\\", "/").split("/")[-1]
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120] or "file"


class PresignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not r2.is_configured():
            return Response({"detail": "File uploads aren't configured."}, status=503)
        target_kwargs, existing = _resolve_target(request, write=True)
        if existing.count() >= settings.ATTACH_MAX_PER_TARGET:
            raise ValidationError({"detail": f"Up to {settings.ATTACH_MAX_PER_TARGET} files."})
        content_type = (request.data.get("content_type") or "").lower()
        kind = _kind_for(content_type)
        if not kind:
            raise ValidationError({"content_type": "That file type isn't allowed."})
        size = int(request.data.get("size") or 0)
        if size <= 0 or size > _max_bytes(kind):
            raise ValidationError({"size": "File is too large."})
        filename = _safe_name(request.data.get("filename"))
        # Namespaced key: <target>/<id>/<uuid>-<name>
        (tkey, tval), = target_kwargs.items()
        key = f"{tkey}/{tval.id}/{uuid.uuid4().hex}-{filename}"
        return Response({"key": key, "put_url": r2.presign_put(key, content_type)})


class AttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _target_kwargs, qs = _resolve_target(request, write=False)
        return Response(AttachmentSerializer(qs, many=True).data)

    def post(self, request):
        """Confirm an upload: HEAD-validate the R2 object, then create the row."""
        if not r2.is_configured():
            return Response({"detail": "File uploads aren't configured."}, status=503)
        target_kwargs, existing = _resolve_target(request, write=True)
        if existing.count() >= settings.ATTACH_MAX_PER_TARGET:
            raise ValidationError({"detail": f"Up to {settings.ATTACH_MAX_PER_TARGET} files."})
        key = request.data.get("key") or ""
        (tkey, tval), = target_kwargs.items()
        if not key.startswith(f"{tkey}/{tval.id}/"):
            raise ValidationError({"key": "Bad object key."})
        meta = r2.head(key)
        if meta is None:
            raise ValidationError({"key": "Upload not found — try again."})
        content_type = (meta.get("ContentType") or request.data.get("content_type") or "").lower()
        kind = _kind_for(content_type)
        size = int(meta.get("ContentLength") or 0)
        if not kind or size <= 0 or size > _max_bytes(kind):
            r2.delete(key)
            raise ValidationError({"detail": "File rejected (type or size)."})
        att = Attachment.objects.create(
            key=key, filename=_safe_name(request.data.get("filename")),
            content_type=content_type, kind=kind, size=size,
            uploaded_by=request.user, **target_kwargs,
        )
        return Response(AttachmentSerializer(att).data, status=201)


class AttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        return get_object_or_404(
            Attachment.objects.select_related("task", "subtask__task", "report"), pk=pk
        )

    def _check(self, request, att, write):
        user, org = request.user, _org(request)
        if att.report_id is not None:
            if not (att.report.user_id == user.id or user.is_superuser):
                raise PermissionDenied("Not allowed.")
            return
        task = att.task or (att.subtask.task if att.subtask_id else None)
        if task is None:
            raise PermissionDenied("Not allowed.")
        if write:
            if not (can_act_as_member(user, task.subproject_id, org) or is_org_admin(user, org)):
                raise PermissionDenied("Not allowed.")
        elif not can_see_task(user, task, org):
            raise PermissionDenied("Not allowed.")

    def delete(self, request, pk):
        att = self._get(pk)
        self._check(request, att, write=True)
        r2.delete(att.key)
        att.delete()
        return Response(status=204)


class AttachmentFileView(APIView):
    """Serves a private file via a short-lived signed capability token (so
    <img>/<video> tags, which can't send the JWT header, still load it). The token
    is only ever handed out by the permission-gated list endpoint."""

    from rest_framework.permissions import AllowAny
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from django.core import signing
        from django.http import HttpResponseRedirect

        try:
            ident = signing.loads(request.query_params.get("t", ""), salt="att-file", max_age=3600)
        except signing.BadSignature:
            raise PermissionDenied("Invalid or expired link.")
        if ident != pk:
            raise PermissionDenied("Invalid link.")
        if not r2.is_configured():
            return Response({"detail": "Not configured."}, status=503)
        att = get_object_or_404(Attachment, pk=pk)
        return HttpResponseRedirect(r2.presign_get(att.key, att.filename))
