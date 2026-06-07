"""Daily history: an accurate point-in-time record of which tasks were live on a
date and who was assigned then (assignees change over time, so the calendar's
'current' view can't answer 'who had the flowers 3 months ago'). The daily cron
stores one denormalized row per day; pruned after RETAIN_DAYS."""

from datetime import date, datetime, timedelta

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.drf import IsAdmin

RETAIN_DAYS = 366


def _on_day(task, day):
    from .recurrence import occurrence_dates

    if task.is_recurring:
        return bool(occurrence_dates(task.recurrence_rule, day, day))
    dl, st = task.deadline, task.timeline_start
    if st and dl:
        return st <= day <= dl
    if dl:
        return day == dl
    if st:
        return day == st
    return False


def build_day_instances(day):
    """Denormalized rows for every approved, non-archived task live on `day`,
    with assignee NAMES captured as they are now (i.e. on `day`)."""
    from .models import Task

    rows = []
    qs = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED, archived_at__isnull=True)
        .select_related("subproject__project")
        .prefetch_related("assignees", "assignee_groups")
    )
    for t in qs:
        if not _on_day(t, day):
            continue
        sp, proj = t.subproject, t.subproject.project
        rows.append({
            "title": t.title,
            "status": t.status,
            "organization_id": proj.organization_id,  # so history can be org-scoped on read
            "project_name": proj.name,
            "project_color": proj.color,
            "subproject_name": sp.name,
            "subproject_color": sp.color,
            "assignees": [u.name or u.email for u in t.assignees.all()],
            "groups": [g.name for g in t.assignee_groups.all()],
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "is_recurring": t.is_recurring,
        })
    rows.sort(key=lambda r: (r["project_name"], r["subproject_name"], r["title"]))
    return rows


def snapshot_history_day(day=None):
    from .models import HistoryDay

    day = day or date.today()
    HistoryDay.objects.update_or_create(date=day, defaults={"instances": build_day_instances(day)})
    # prune old history
    cutoff = date.today() - timedelta(days=RETAIN_DAYS)
    HistoryDay.objects.filter(date__lt=cutoff).delete()


def _parse(d, field):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError({field: "Expected YYYY-MM-DD."})


class HistoryView(APIView):
    """Admin: stored daily history for a date range. Returns flat instances, each
    tagged with its date (so the client can render day/week views)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        from .models import HistoryDay

        org = getattr(request, "org", None)
        out = []
        for h in HistoryDay.objects.filter(date__gte=start, date__lte=end):
            iso = h.date.isoformat()
            for inst in h.instances:
                # Org-scoped: only this org's snapshot rows (older rows lacking the
                # org tag are excluded rather than leaked).
                if org is not None and inst.get("organization_id") != org.id:
                    continue
                out.append({**inst, "date": iso})
        return Response(out)


class HistoryDatesView(APIView):
    """Which dates have a stored snapshot (for the date picker bounds)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import HistoryDay

        dates = list(HistoryDay.objects.values_list("date", flat=True))
        return Response({"dates": [d.isoformat() for d in dates]})
