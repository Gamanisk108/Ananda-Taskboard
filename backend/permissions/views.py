from rest_framework import viewsets

from .drf import IsAdmin
from .models import AccessGrant
from .serializers import AccessGrantSerializer


class AccessGrantViewSet(viewsets.ModelViewSet):
    """Admin-only management of access grants (the visibility gate)."""

    queryset = AccessGrant.objects.select_related("user", "group", "subproject", "project").all()
    serializer_class = AccessGrantSerializer
    permission_classes = [IsAdmin]
