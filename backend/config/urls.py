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
from rest_framework.routers import DefaultRouter

from restore_service import RestorePointViewSet
from sharing.public_views import share_card, share_landing
from trashbin import TrashActionView, TrashView

FRONTEND_DIST = settings.BASE_DIR.parent / "frontend" / "dist"

_restore_router = DefaultRouter(trailing_slash=False)
_restore_router.register("restore-points", RestorePointViewSet, basename="restorepoint")


def health(_request):
    from django.db import connection

    # 'postgresql' once DATABASE_URL points at Neon/Postgres; 'sqlite' otherwise.
    return JsonResponse({"status": "ok", "service": "ananda-taskboard", "database": connection.vendor})


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
    path("api/", include("translations.urls")),
    path("api/", include("feedback.urls")),
    path("api/", include("attachments.urls")),
    path("api/", include("ai.urls")),
    path("api/", include("sharing.urls")),
    path("api/", include("apikeys.urls")),
    # Public share-card unfurl routes — OUTSIDE /api/ and the SPA catch-all so
    # chat bots can fetch them unauthenticated.
    path("s/<str:token>", share_landing, name="share-landing"),
    path("s/<str:token>/card.png", share_card, name="share-card"),
    path("api/trash", TrashView.as_view(), name="trash"),
    path("api/trash/action", TrashActionView.as_view(), name="trash-action"),
    path("api/", include(_restore_router.urls)),  # restore points (admin)
    # SPA catch-all (must be last; excludes api/, admin/, and the s/ share routes).
    re_path(r"^(?!api/|admin/|s/)(?P<path>.*)$", spa, name="spa"),
]
