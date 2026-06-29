"""API routes (mounted under /api/). The PUBLIC /s/<token> routes live in
config/urls.py so they sit OUTSIDE /api/ and the SPA catch-all."""

from django.urls import path

from .views import ShareCreateView, ShareDetailView, ShareRevokeView

urlpatterns = [
    path("share", ShareCreateView.as_view(), name="share-create"),
    path("share/<str:token>", ShareDetailView.as_view(), name="share-detail"),
    path("share/<str:token>/revoke", ShareRevokeView.as_view(), name="share-revoke"),
]
