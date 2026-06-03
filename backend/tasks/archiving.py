"""Auto-archive completed tasks. A task that has been Done and untouched for
ARCHIVE_AFTER_DAYS is moved to the Archive (archived_at set) — hidden from the
board/list/calendar but recoverable via /api/tasks/{id}/unarchive."""

from datetime import timedelta

from django.utils import timezone

ARCHIVE_AFTER_DAYS = 7


def archive_completed(days=ARCHIVE_AFTER_DAYS):
    from .models import Task, complete_status_keys

    cutoff = timezone.now() - timedelta(days=days)
    return Task.objects.filter(
        status__in=complete_status_keys(), archived_at__isnull=True, updated_at__lt=cutoff
    ).update(archived_at=timezone.now())


def auto_complete_overdue():
    """One-off tasks flagged auto_complete that are past their deadline get marked
    Done automatically (so mundane tasks don't linger as overdue). Runs in the
    daily cron, i.e. the morning after the deadline."""
    from datetime import date
    from .models import Status, Task, complete_status_keys

    done_key = (Status.objects.filter(is_complete=True).order_by("order").values_list("key", flat=True).first()) or "done"
    return (
        Task.objects.filter(
            auto_complete=True, recurrence_rule__isnull=True,
            archived_at__isnull=True, deadline__lt=date.today(),
        )
        .exclude(status__in=complete_status_keys())
        .update(status=done_key)
    )
