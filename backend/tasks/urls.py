from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ApprovalsView, TaskViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tasks", TaskViewSet, basename="task")

urlpatterns = [
    path("approvals", ApprovalsView.as_view(), name="approvals"),
] + router.urls
