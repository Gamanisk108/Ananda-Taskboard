"""Root URL configuration.

API routes live under /api/. In a built deployment, Django also serves the
compiled React SPA from frontend/dist so the whole app runs from ONE server
(http://localhost:8000) — no separate frontend process, no PowerShell juggling.
"""

import mimetypes

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, JsonResponse
from django.urls import include, path, re_path

from trashbin import TrashActionView, TrashView

FRONTEND_DIST = settings.BASE_DIR.parent / "frontend" / "dist"


def health(_request):
    return JsonResponse({"status": "ok", "service": "ananda-taskboard"})


def spa(request, path=""):
    """Serve a built static file if it exists, else index.html (SPA fallback)."""
    candidate = (FRONTEND_DIST / path).resolve()
    # path-traversal guard: must stay inside dist
    if path and str(candidate).startswith(str(FRONTEND_DIST.resolve())) and candidate.is_file():
        ctype, _ = mimetypes.guess_type(str(candidate))
        return FileResponse(open(candidate, "rb"), content_type=ctype or "application/octet-stream")
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return JsonResponse(
        {"detail": "Frontend not built. Run `npm run build` in frontend/."},
        status=404,
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    path("api/", include("accounts.urls")),
    path("api/", include("projects.urls")),
    path("api/", include("permissions.urls")),
    path("api/", include("tasks.urls")),
    path("api/", include("exporting.urls")),
    path("api/", include("notifications.urls")),
    path("api/trash", TrashView.as_view(), name="trash"),
    path("api/trash/action", TrashActionView.as_view(), name="trash-action"),
    # SPA catch-all (must be last; excludes api/ and admin/).
    re_path(r"^(?!api/|admin/)(?P<path>.*)$", spa, name="spa"),
]
