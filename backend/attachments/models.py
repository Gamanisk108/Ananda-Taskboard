"""Media attachments (images / documents / short video) on tasks, subtasks, and
bug reports. The bytes live in Cloudflare R2 (object storage); only a reference
row lives here. The bucket is private — files are served through an authenticated
redirect to a short-lived presigned URL, so task data stays gated."""
from django.conf import settings
from django.db import models


class Attachment(models.Model):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        DOC = "doc", "Document"
        VIDEO = "video", "Video"

    # Exactly one target is set.
    task = models.ForeignKey("tasks.Task", null=True, blank=True, on_delete=models.CASCADE, related_name="attachments")
    subtask = models.ForeignKey("tasks.Subtask", null=True, blank=True, on_delete=models.CASCADE, related_name="attachments")
    report = models.ForeignKey("feedback.ProblemReport", null=True, blank=True, on_delete=models.CASCADE, related_name="attachments")

    key = models.CharField(max_length=400, unique=True)  # R2 object key
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.IMAGE)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="attachments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.filename} ({self.kind})"
