from rest_framework import viewsets

from .drf import IsAdmin
from .models import AccessGrant, Exclusion
from .serializers import AccessGrantSerializer, ExclusionSerializer


class AccessGrantViewSet(viewsets.ModelViewSet):
    """Admin-only management of access grants (the visibility gate)."""

    queryset = AccessGrant.objects.select_related(
        "user", "group", "tier", "subproject", "project"
    ).all()
    serializer_class = AccessGrantSerializer
    permission_classes = [IsAdmin]


class ExclusionViewSet(viewsets.ModelViewSet):
    """Admin-only management of exclusions (deny rules that subtract visibility)."""

    queryset = Exclusion.objects.select_related(
        "user", "group", "tier",
        "excluded_user", "excluded_group", "excluded_project", "excluded_subproject", "excluded_task",
    ).all()
    serializer_class = ExclusionSerializer
    permission_classes = [IsAdmin]
