from django.db.models import Q
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .drf import IsAdmin
from .models import AccessGrant, AuditLog, Exclusion, audit
from .serializers import AccessGrantSerializer, ExclusionSerializer


class AccessGrantViewSet(viewsets.ModelViewSet):
    """Admin-only management of access grants (the visibility gate), scoped to
    the active org via the grant's target sub-project/project."""

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

    def perform_create(self, serializer):
        grant = serializer.save()
        audit(self.request.user, "grant.create", f"Granted {grant}")

    def perform_destroy(self, instance):
        audit(self.request.user, "grant.delete", f"Revoked {instance}")
        instance.delete()


class ExclusionViewSet(viewsets.ModelViewSet):
    """Admin-only management of exclusions (deny rules that subtract visibility)."""

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

    def perform_create(self, serializer):
        exc = serializer.save()
        audit(self.request.user, "exclusion.create", f"Added exclusion {exc}")

    def perform_destroy(self, instance):
        audit(self.request.user, "exclusion.delete", f"Removed exclusion {instance}")
        instance.delete()


class AuditLogView(APIView):
    """Admin-only: the most recent permission/visibility changes."""

    permission_classes = [IsAdmin]

    def get(self, request):
        rows = AuditLog.objects.select_related("actor")[:200]
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
