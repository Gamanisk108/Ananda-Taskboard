from django.urls import path

from .export import ExportView

urlpatterns = [
    path("export", ExportView.as_view(), name="export"),
]
