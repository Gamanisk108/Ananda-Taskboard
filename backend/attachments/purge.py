"""90-day retention for bug-report attachments (matches the screenshot purge).
Task/subtask attachments are kept for the life of the task."""
from datetime import timedelta

from django.utils import timezone

from . import r2
from .models import Attachment

PURGE_DAYS = 90


def purge_old_report_attachments(days: int = PURGE_DAYS) -> int:
    cutoff = timezone.now() - timedelta(days=days)
    n = 0
    for att in Attachment.objects.filter(report__isnull=False, created_at__lt=cutoff):
        r2.delete(att.key)
        att.delete()
        n += 1
    return n
