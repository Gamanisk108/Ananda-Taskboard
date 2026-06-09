from django.urls import path

from .views import ReportProblemView, SuggestFeatureView

urlpatterns = [
    path("feedback/report", ReportProblemView.as_view(), name="feedback-report"),
    path("feedback/suggest", SuggestFeatureView.as_view(), name="feedback-suggest"),
]
