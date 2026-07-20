from rest_framework import viewsets

from permissions.drf import IsAdminOrReadOnly
from permissions.engine import is_org_admin, visible_project_ids, visible_subproject_ids

from .models import Project, SubProject
from .serializers import ProjectSerializer, SubProjectSerializer


def _org(request):
    """Active organization for this request (set by OrgContextMiddleware)."""
    return getattr(request, "org", None)


class ProjectViewSet(viewsets.ModelViewSet):
    """Admin write; read filtered to the caller's visible sub-projects. All
    queries are scoped to the active org (admins see their org's projects only;
    a superuser scopes to whichever org they're viewing)."""

    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        org = _org(self.request)
        if is_org_admin(user, org):
            qs = Project.objects.all()
            return qs.filter(organization=org) if org is not None else qs
        return Project.objects.filter(id__in=visible_project_ids(user, org))

    def perform_create(self, serializer):
        serializer.save(organization=_org(self.request))

    def perform_destroy(self, instance):
        from trashbin import soft_delete_project

        soft_delete_project(instance, by=self.request.user)  # cascade soft-delete (restorable for 7 days)


class SubProjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubProjectSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        org = _org(self.request)
        if is_org_admin(user, org):
            qs = SubProject.objects.all()
            return qs.filter(project__organization=org) if org is not None else qs
        return SubProject.objects.filter(id__in=visible_subproject_ids(user, org))

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["org"] = _org(self.request)
        return ctx

    def perform_destroy(self, instance):
        from trashbin import soft_delete_subproject

        soft_delete_subproject(instance, by=self.request.user)  # cascade soft-delete its tasks too
