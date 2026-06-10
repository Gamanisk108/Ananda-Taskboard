from django.urls import path

from .views import AttachmentDetailView, AttachmentFileView, AttachmentListCreateView, PresignView

urlpatterns = [
    path("attachments/presign", PresignView.as_view(), name="attachment-presign"),
    path("attachments", AttachmentListCreateView.as_view(), name="attachment-list"),
    path("attachments/<int:pk>/file", AttachmentFileView.as_view(), name="attachment-file"),
    path("attachments/<int:pk>", AttachmentDetailView.as_view(), name="attachment-detail"),
]
