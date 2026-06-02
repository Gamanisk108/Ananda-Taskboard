from django.urls import path

from .summary import GroupChatSummaryView
from .views import AppSettingsView, DailyPushJobView, PushConfigView, SubscribeView

urlpatterns = [
    path("push/config", PushConfigView.as_view(), name="push-config"),
    path("push/subscribe", SubscribeView.as_view(), name="push-subscribe"),
    path("summary/groupchat", GroupChatSummaryView.as_view(), name="summary-groupchat"),
    path("settings", AppSettingsView.as_view(), name="app-settings"),
    path("jobs/daily-push", DailyPushJobView.as_view(), name="daily-push-job"),
]
