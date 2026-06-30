"""Authenticated API for the SPA to mint / adjust / revoke share links.

  POST   /api/share                 {type, id}            -> create or return the link
  PATCH  /api/share/<token>         {include_description} -> toggle the description
  POST   /api/share/<token>/revoke                        -> kill the link

Minting requires the requester can VIEW the item (same engine as the app, so a
link never exposes more than the user already sees). Toggling/revoking requires
being the link's creator or an org admin.
"""

from django.apps import apps
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .describe import can_view, describe
from .models import SHAREABLE, ShareLink

# ORM path from each shareable model to its owning Organization — used to SCOPE
# the lookup query by tenant so a cross-org row is never even materialized.
_ORG_PATH = {
    "task": "subproject__project__organization",
    "subtask": "task__subproject__project__organization",
    "subproject": "project__organization",
    "project": "organization",
}


def _org(request):
    return getattr(request, "org", None)


def _resolve_object(type_: str, obj_id, org):
    spec = SHAREABLE.get(type_)
    if spec is None:
        raise ValidationError({"type": f"Not shareable: {type_!r}."})
    model = apps.get_model(*spec)
    try:
        # Tenant-scoped query (live-only default manager): a wrong-org or missing
        # id both resolve to None -> uniform 404, no cross-org row ever loaded.
        obj = model.objects.filter(pk=obj_id, **{_ORG_PATH[type_]: org}).first()
    except (TypeError, ValueError, DjangoValidationError):
        raise ValidationError({"id": "Invalid id."})
    if obj is None:
        raise NotFound("Item not found.")
    return obj


def _serialize(link, request):
    spec = describe(link.target)
    return {
        "token": link.token,
        "type": link.public_type,
        "object_id": link.object_id,
        "url": request.build_absolute_uri(f"/s/{link.token}"),
        "include_description": link.include_description,
        "deep_link": spec.deep_link,
        "revoked": link.is_revoked,
        "created_at": link.created_at,
    }


def _may_manage(user, link, org) -> bool:
    from permissions.engine import is_org_admin

    return link.created_by_id == user.id or is_org_admin(user, org)


class ShareCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org = _org(request)
        if org is None:
            raise ValidationError({"detail": "No active organization."})
        type_ = request.data.get("type")
        obj_id = request.data.get("id")
        if not type_ or obj_id in (None, ""):
            raise ValidationError({"detail": "type and id are required."})

        obj = _resolve_object(type_, obj_id, org)
        # Visibility gate (tenant already enforced in _resolve_object): the
        # requester must actually be able to see the item.
        if not can_view(request.user, obj, org):
            raise PermissionDenied("You don't have access to this item.")

        link, _created = ShareLink.objects.get_or_create_for(obj, user=request.user, org=org)
        return Response(_serialize(link, request))


class ShareDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_manageable(self, request, token):
        org = _org(request)
        link = ShareLink.objects.filter(token=token, revoked_at__isnull=True).first()
        # Wrong-org is reported as 404 (not 403) so the response can't be used as
        # an oracle to tell "valid token in another org" from "unknown token".
        if link is None or link.organization_id != getattr(org, "id", None):
            raise NotFound("Share link not found.")
        if not _may_manage(request.user, link, org):
            raise PermissionDenied("Only the link's creator or an admin can change it.")
        return link

    def patch(self, request, token):
        link = self._get_manageable(request, token)
        if "include_description" in request.data:
            value = request.data["include_description"]
            # Require a real boolean — bool("false") is True, so a stringified
            # payload must not silently leave the description exposed.
            if not isinstance(value, bool):
                raise ValidationError({"include_description": "Must be a boolean."})
            link.include_description = value
            link.save(update_fields=["include_description"])
        return Response(_serialize(link, request))


class ShareRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        org = _org(request)
        link = ShareLink.objects.filter(token=token, revoked_at__isnull=True).first()
        if link is None or link.organization_id != getattr(org, "id", None):
            raise NotFound("Share link not found.")  # uniform 404 (no cross-org oracle)
        if not _may_manage(request.user, link, org):
            raise PermissionDenied("Only the link's creator or an admin can revoke it.")
        from django.utils import timezone

        link.revoked_at = timezone.now()
        link.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
