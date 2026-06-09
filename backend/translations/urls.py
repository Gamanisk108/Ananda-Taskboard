from django.urls import path

from .views import ApproveView, MySuggestionsView, OverridesView, OverrideView, ReviewView

urlpatterns = [
    path("translations/mine", MySuggestionsView.as_view(), name="translations-mine"),
    path("translations/overrides", OverridesView.as_view(), name="translations-overrides"),
    path("translations/review", ReviewView.as_view(), name="translations-review"),
    path("translations/approve", ApproveView.as_view(), name="translations-approve"),
    path("translations/override", OverrideView.as_view(), name="translations-override"),
]
