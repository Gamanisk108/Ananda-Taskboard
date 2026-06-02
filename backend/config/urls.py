"""Root URL configuration. API routes live under /api/ and are added per app
as each build step lands them. A health endpoint is always available."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok", "service": "ananda-taskboard"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    path("api/", include("accounts.urls")),  # step 2: auth + me
    path("api/", include("projects.urls")),  # step 3: projects + subprojects
    # /api/<feature> includes are appended by later build steps.
]
