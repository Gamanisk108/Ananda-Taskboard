from django.db.models import Q
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .drf import IsAdmin
from .models import AccessGrant, AuditLog, Exclusion, audit
from .serializers import AccessGrantSerializer, ExclusionSerializer


class AccessGrantViewSet(viewsets.ModelViewSet):
    """Admin-only management of access grants (the visibility gate), scoped to
    the active org via the grant's target sub-project/project. The serializer's
    validate() (permissions/serializers.py) rejects a create/update whose
    user/group/tier/subproject/project doesn't belong to the active org — reads
    were already scoped here, but nothing stopped the WRITE from targeting
    another tenant (2026-07-19 security fix, critical)."""

    queryset = AccessGrant.objects.select_related(
        "user", "group", "tier", "subproject", "project"
    ).all()
    serializer_class = AccessGrantSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        qs = AccessGrant.objects.select_related("user", "group", "tier", "subproject", "project")
        if org is not None:
            qs = qs.filter(Q(subproject__project__organization=org) | Q(project__organization=org))
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["org"] = getattr(self.request, "org", None)
        return ctx

    def perform_create(self, serializer):
        grant = serializer.save()
        audit(self.request.user, "grant.create", f"Granted {grant}", organization=getattr(self.request, "org", None))

    def perform_destroy(self, instance):
        audit(self.request.user, "grant.delete", f"Revoked {instance}", organization=getattr(self.request, "org", None))
        instance.delete()


class ExclusionViewSet(viewsets.ModelViewSet):
    """Admin-only management of exclusions (deny rules that subtract visibility).
    See AccessGrantViewSet's docstring — same cross-org write guard applies via
    the serializer's validate()."""

    queryset = Exclusion.objects.select_related(
        "user", "group", "tier",
        "excluded_user", "excluded_group", "excluded_project", "excluded_subproject", "excluded_task",
    ).all()
    serializer_class = ExclusionSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        org = getattr(self.request, "org", None)
        qs = Exclusion.objects.select_related(
            "user", "group", "tier",
            "excluded_user", "excluded_group", "excluded_project", "excluded_subproject", "excluded_task",
        )
        if org is not None:
            qs = qs.filter(
                Q(group__organization=org) | Q(tier__organization=org)
                | Q(excluded_subproject__project__organization=org)
                | Q(excluded_project__organization=org)
                | Q(excluded_group__organization=org)
                | Q(excluded_task__subproject__project__organization=org)
                | Q(user__memberships__organization=org)
                | Q(excluded_user__memberships__organization=org)
            ).distinct()
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["org"] = getattr(self.request, "org", None)
        return ctx

    def perform_create(self, serializer):
        exc = serializer.save()
        audit(self.request.user, "exclusion.create", f"Added exclusion {exc}", organization=getattr(self.request, "org", None))

    def perform_destroy(self, instance):
        audit(self.request.user, "exclusion.delete", f"Removed exclusion {instance}", organization=getattr(self.request, "org", None))
        instance.delete()


class AuditLogView(APIView):
    """Admin-only: the most recent permission/visibility changes, scoped to the
    active org. (2026-07-19 security fix: this used to return every
    organization's entries — names/emails/security actions — to any org's
    local admin, since the query had no org filter at all.)"""

    permission_classes = [IsAdmin]

    def get(self, request):
        org = getattr(request, "org", None)
        qs = AuditLog.objects.select_related("actor")
        # org is None only in legacy/no-header mode (pre-tenancy fallback); a
        # real request always carries X-Org-Id, so this scopes every live call.
        qs = qs.filter(organization=org) if org is not None else qs
        rows = qs[:200]
        return Response([
            {
                "id": r.id,
                "actor": (r.actor.name or r.actor.email) if r.actor else "—",
                "action": r.action,
                "summary": r.summary,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ])
