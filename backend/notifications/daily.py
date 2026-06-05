"""Daily push: each morning every user gets a push listing THEIR tasks for the
day plus overdue ones. Silent when there's nothing. Local-time/DST-safe via
APP_TIMEZONE, and fired at most once per local day per user.

Triggered by the GitHub Actions cron hitting POST /api/jobs/daily-push with the
shared secret; the secret check + once-per-day guard live here so the cron time
can be approximate.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Q

from tasks.models import Task
from tasks.recurrence import occurrence_dates


def local_today():
    from .models import AppSettings

    tz = AppSettings.load().timezone or settings.APP_TIMEZONE
    try:
        return datetime.now(ZoneInfo(tz)).date()
    except Exception:
        return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def tasks_for_user(user, today):
    """Return (due_today, overdue) title lists for a user's assigned, approved,
    visible tasks. De-duplicated. Assignment counts direct assignees AND any group
    the user belongs to. Recurring tasks contribute a 'due today' entry when an
    occurrence lands today."""
    from django.db.models import Q

    from permissions.engine import visible_tasks_q
    from tasks.models import complete_status_keys

    group_ids = list(user.member_groups.values_list("id", flat=True))
    assigned = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED, archived_at__isnull=True)
        .filter(visible_tasks_q(user))  # respects own-scope + exclusions (deny > assignment)
        .exclude(status__in=complete_status_keys())  # completed tasks don't need a reminder
        .filter(Q(assignees=user) | Q(assignee_groups__in=group_ids))
        .select_related("recurrence_rule")
        .distinct()
    )
    due_today, overdue = [], []
    seen_due, seen_over = set(), set()
    for t in assigned:
        if t.is_recurring:
            if occurrence_dates(t.recurrence_rule, today, today):
                if t.id not in seen_due:
                    due_today.append(t.title); seen_due.add(t.id)
        else:
            if t.deadline == today and t.id not in seen_due:
                due_today.append(t.title); seen_due.add(t.id)
            elif t.deadline and t.deadline < today and t.status != Task.Status.DONE and t.id not in seen_over:
                overdue.append(t.title); seen_over.add(t.id)
    return due_today, overdue


def build_payload(due_today, overdue):
    if not due_today and not overdue:
        return None  # silent — nothing to say
    lines = []
    if due_today:
        lines.append(f"{len(due_today)} due today")
    if overdue:
        lines.append(f"{len(overdue)} overdue")
    return {
        "title": "Ananda Taskboard — today",
        "body": " · ".join(lines),
        "due_today": due_today,
        "overdue": overdue,
    }


def run_daily_push(send=True):
    """Build and (optionally) send the daily push to every active user who has
    something today. Returns a summary dict for logging/tests. Idempotent per
    local day via User.last_daily_push."""
    from accounts.models import User
    from .push import send_web_push

    today = local_today()
    recipients = 0
    sent = 0
    for user in User.objects.filter(is_active=True, daily_push_enabled=True):
        if user.last_daily_push == today:
            continue  # already pushed today
        due_today, overdue = tasks_for_user(user, today)
        payload = build_payload(due_today, overdue)
        user.last_daily_push = today
        user.save(update_fields=["last_daily_push"])
        if payload is None:
            continue  # silent
        recipients += 1
        if send:
            for sub in user.push_subscriptions.all():
                if send_web_push(sub, payload):
                    sent += 1
    return {"date": today.isoformat(), "recipients": recipients, "pushes_sent": sent}
