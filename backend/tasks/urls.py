from django.urls import path
from rest_framework.routers import DefaultRouter

from .calendar import CalendarView
from .events_views import CalendarEventViewSet, EventsRangeView, StatusViewSet
from .history_service import HistoryDatesView, HistoryView
from .views import ApprovalsView, TaskViewSet

router = DefaultRouter(trailing_slash=False)
router.register("tasks", TaskViewSet, basename="task")
router.register("events", CalendarEventViewSet, basename="event")
router.register("statuses", StatusViewSet, basename="status")

urlpatterns = [
    path("approvals", ApprovalsView.as_view(), name="approvals"),
    path("calendar", CalendarView.as_view(), name="calendar"),
    path("events/range", EventsRangeView.as_view(), name="events-range"),  # before router
    path("history", HistoryView.as_view(), name="history"),
    path("history/dates", HistoryDatesView.as_view(), name="history-dates"),
] + router.urls
