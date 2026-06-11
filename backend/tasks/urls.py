from django.urls import path
from rest_framework.routers import DefaultRouter

from .bulk import BulkTasksView, MarkDoneView
from .calendar import CalendarView, UndatedTasksView
from .events_views import (
    CalendarEventViewSet,
    EventsRangeView,
    HolidaySettingsView,
    HolidaysRangeView,
    PersonalHolidayViewSet,
    StatusViewSet,
)
from .history_service import HistoryDatesView, HistoryView
from .views import ApprovalsView, CommentViewSet, MyPendingApprovalsView, SubtaskViewSet, TaskViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tasks", TaskViewSet, basename="task")
router.register("subtasks", SubtaskViewSet, basename="subtask")
router.register("comments", CommentViewSet, basename="comment")
router.register("events", CalendarEventViewSet, basename="event")
router.register("holidays/personal", PersonalHolidayViewSet, basename="personal-holiday")
router.register("statuses", StatusViewSet, basename="status")

urlpatterns = [
    path("approvals", ApprovalsView.as_view(), name="approvals"),
    path("approvals/mine", MyPendingApprovalsView.as_view(), name="approvals-mine"),
    path("calendar", CalendarView.as_view(), name="calendar"),
    path("calendar/undated", UndatedTasksView.as_view(), name="calendar-undated"),
    path("events/range", EventsRangeView.as_view(), name="events-range"),  # before router
    path("holidays/range", HolidaysRangeView.as_view(), name="holidays-range"),
    path("holidays/settings", HolidaySettingsView.as_view(), name="holidays-settings"),
    path("history", HistoryView.as_view(), name="history"),
    path("history/dates", HistoryDatesView.as_view(), name="history-dates"),
    path("tasks/bulk", BulkTasksView.as_view(), name="tasks-bulk"),  # before router (pk route)
    path("<str:kind>/<int:pk>/mark-done", MarkDoneView.as_view(), name="mark-done"),
] + router.urls
