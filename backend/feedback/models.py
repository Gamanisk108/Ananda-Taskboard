"""Help Us community flows (design D41): Report a problem · Suggest a feature.

Records are stored in the DB and the platform owner is notified by email — there
is deliberately NO in-app read surface in v1 (a superadmin inbox is a v2 design
ask; see CODE-AUDIT-FEEDBACK.md §4).

Screenshots: the host's disk is ephemeral and there is no file store, so a
report's screenshot is a small client-side-compressed data-URL stored inline
(hard-capped) and auto-purged after PURGE_DAYS by the daily job.
"""

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

# data-URL cap: ~1 MB of binary ≈ 1.37 MB base64 — generous for a compressed
# screenshot, tiny for Postgres.
MAX_SCREENSHOT_CHARS = 1_400_000
PURGE_DAYS = 90


class ProblemReport(models.Model):
    """A member's bug/confusion report from Help Us → Report a problem."""

    class Severity(models.TextChoices):
        MINOR = "minor", "Minor"
        SLOWS = "slows", "Slows me down"
        BLOCKS = "blocks", "Blocks me"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="problem_reports"
    )
    organization = models.ForeignKey(
        "accounts.Organization", null=True, blank=True, on_delete=models.SET_NULL, related_name="problem_reports"
    )
    message = models.TextField()
    where = models.CharField(max_length=60, blank=True)  # app area key, e.g. "calendar"
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MINOR)
    # Browser + current page, collected client-side when the toggle is on.
    tech = models.JSONField(default=dict, blank=True)
    # Compressed screenshot as a data-URL ("" = none) — purged after PURGE_DAYS.
    screenshot = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def ref(self) -> str:
        """The mono reference number shown to the reporter (design D41)."""
        return f"TB-{self.id:04d}"

    def __str__(self):
        return f"{self.ref} [{self.severity}] {self.message[:50]!r}"


class FeatureSuggestion(models.Model):
    """An idea from Help Us → Suggest a feature."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="feature_suggestions"
    )
    organization = models.ForeignKey(
        "accounts.Organization", null=True, blank=True, on_delete=models.SET_NULL, related_name="feature_suggestions"
    )
    idea = models.CharField(max_length=300)
    detail = models.TextField(blank=True)
    area = models.CharField(max_length=60, blank=True)
    notify_when_shipped = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FS-{self.id} {self.idea[:50]!r}"


def purge_old_screenshots(days: int = PURGE_DAYS) -> int:
    """Blank screenshots older than `days` (keep the report text forever — only
    the image is space/PII-sensitive). Idempotent; piggybacked on the daily job."""
    cutoff = timezone.now() - timedelta(days=days)
    return ProblemReport.objects.filter(created_at__lt=cutoff).exclude(screenshot="").update(screenshot="")
