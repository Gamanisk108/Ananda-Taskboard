from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AccessGrantViewSet, AuditLogView, ExclusionViewSet

router = DefaultRouter(trailing_slash=False)
router.register("grants", AccessGrantViewSet, basename="grant")
router.register("exclusions", ExclusionViewSet, basename="exclusion")

urlpatterns = [path("audit", AuditLogView.as_view(), name="audit")] + router.urls
