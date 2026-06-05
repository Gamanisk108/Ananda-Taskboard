"""Calendar/timeline endpoint: expands tasks into dated instances within a window
for the weekly and monthly views. Non-recurring tasks appear on their deadline;
recurring tasks appear once per generated occurrence. Visibility + approved-only
are enforced; overdue is flagged."""

from datetime import date, datetime, timedelta

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.engine import visible_tasks_q

from .models import Task
from .recurrence import occurrence_dates


def _parse(d, field):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValidationError({field: "Expected YYYY-MM-DD."})


def _instance(task, on_date, today, is_deadline):
    sp = task.subproject
    proj = sp.project
    return {
        "task_id": task.id,
        "title": task.title,
        "date": on_date.isoformat(),
        "status": task.status,
        "is_recurring": task.is_recurring,
        "is_deadline": is_deadline,  # the actual due day of a multi-day span
        "subproject_id": sp.id,
        "subproject_name": sp.name,
        "subproject_color": sp.color,
        "project_id": proj.id,
        "project_name": proj.name,
        "project_color": proj.color,
        # overdue = past the deadline and not done (highlights every spanned day)
        "overdue": bool(task.deadline and task.deadline < today and task.status != Task.Status.DONE),
        "assignee_ids": [u.id for u in task.assignees.all()],
        # time-of-day (HH:MM) when the task is timed, else null
        "start_time": task.start_time.strftime("%H:%M") if task.start_time else None,
        "end_time": task.end_time.strftime("%H:%M") if task.end_time else None,
        "priority": task.priority,
    }


class CalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        if end < start:
            raise ValidationError({"to": "Must be on/after 'from'."})

        from .models import complete_status_keys

        user = request.user
        org = getattr(request, "org", None)
        qs = (
            Task.objects.filter(approval_state=Task.Approval.APPROVED, archived_at__isnull=True)
            .exclude(status__in=complete_status_keys())  # completed tasks drop off the calendar
            .select_related("subproject__project", "recurrence_rule")
            .prefetch_related("assignees")
        )
        # Always through the engine — it org-scopes admins too (no cross-org leak).
        qs = qs.filter(visible_tasks_q(user, org)).distinct()

        for key, field in (("project", "subproject__project_id"), ("subproject", "subproject_id")):
            if request.query_params.get(key):
                qs = qs.filter(**{field: request.query_params[key]})

        today = date.today()
        out = []
        for task in qs:
            if task.is_recurring:
                # each occurrence is a single day (deadline-day semantics)
                for d in occurrence_dates(task.recurrence_rule, start, end):
                    out.append(_instance(task, d, today, is_deadline=True))
                continue
            # Non-recurring span → shows on every day up to the deadline.
            # Start = explicit Start date; else (deadline only) the creation date,
            # so a deadline'd task spans from when it was made to its due date.
            span_end = task.deadline or task.timeline_start
            if not span_end:
                continue  # no dates → only in the list view, not the calendar
            if task.timeline_start:
                span_start = task.timeline_start
            elif task.deadline and task.created_at:
                created = task.created_at.date()
                span_start = min(created, task.deadline)  # if created after the deadline, just the day
            else:
                span_start = span_end
            if span_start > span_end:
                span_start, span_end = span_end, span_start
            d = max(span_start, start)
            last = min(span_end, end)
            while d <= last:
                out.append(_instance(task, d, today, is_deadline=(d == task.deadline)))
                d += timedelta(days=1)
        out.sort(key=lambda i: (i["date"], i["project_name"], i["title"]))
        return Response(out)
