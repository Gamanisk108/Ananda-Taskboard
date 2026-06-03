"""Auto-archive completed tasks. A task that has been Done and untouched for
ARCHIVE_AFTER_DAYS is moved to the Archive (archived_at set) — hidden from the
board/list/calendar but recoverable via /api/tasks/{id}/unarchive."""

from datetime import timedelta

from django.utils import timezone

ARCHIVE_AFTER_DAYS = 7


def archive_completed(days=ARCHIVE_AFTER_DAYS):
    from .models import Task

    cutoff = timezone.now() - timedelta(days=days)
    return Task.objects.filter(
        status=Task.Status.DONE, archived_at__isnull=True, updated_at__lt=cutoff
    ).update(archived_at=timezone.now())
