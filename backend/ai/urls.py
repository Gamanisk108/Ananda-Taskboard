from django.urls import path

from .views import GenerateTasksView

urlpatterns = [
    path("ai/generate", GenerateTasksView.as_view(), name="ai-generate"),
]
