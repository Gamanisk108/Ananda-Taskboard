from django.urls import path

from .export import ExportView
from .views import ImportView

urlpatterns = [
    path("export", ExportView.as_view(), name="export"),
    path("import", ImportView.as_view(), name="import"),
]
