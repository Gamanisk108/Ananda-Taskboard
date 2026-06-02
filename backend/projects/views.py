from rest_framework import viewsets

from permissions.drf import IsAdminOrReadOnly

from .models import Project, SubProject
from .serializers import ProjectSerializer, SubProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    """Admin write; read filtered to the caller's visible sub-projects.

    Step 4 fills in the permission engine. Until then admins see all and the
    engine import is optional, so the app runs at each step boundary."""

    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return Project.objects.all()
        try:
            from permissions.engine import visible_project_ids

            return Project.objects.filter(id__in=visible_project_ids(user))
        except (ImportError, ModuleNotFoundError):
            return Project.objects.none()


class SubProjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubProjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return SubProject.objects.all()
        try:
            from permissions.engine import visible_subproject_ids

            return SubProject.objects.filter(id__in=visible_subproject_ids(user))
        except (ImportError, ModuleNotFoundError):
            return SubProject.objects.none()
