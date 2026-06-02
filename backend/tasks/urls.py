from django.urls import path
from rest_framework.routers import DefaultRouter

from .calendar import CalendarView
from .views import ApprovalsView, SubtaskViewSet, TaskViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tasks", TaskViewSet, basename="task")
router.register("subtasks", SubtaskViewSet, basename="subtask")

urlpatterns = [
    path("approvals", ApprovalsView.as_view(), name="approvals"),
    path("calendar", CalendarView.as_view(), name="calendar"),
] + router.urls
