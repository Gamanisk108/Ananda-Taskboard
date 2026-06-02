"""Calendar/timeline endpoint: expands tasks into dated instances within a window
for the weekly and monthly views. Non-recurring tasks appear on their deadline;
recurring tasks appear once per generated occurrence. Visibility + approved-only
are enforced; overdue is flagged."""

from datetime import date, datetime, timedelta

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.engine import visible_subproject_ids

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
    }


class CalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        if end < start:
            raise ValidationError({"to": "Must be on/after 'from'."})

        user = request.user
        qs = (
            Task.objects.filter(approval_state=Task.Approval.APPROVED)
            .select_related("subproject__project", "recurrence_rule")
            .prefetch_related("assignees")
        )
        if not user.is_admin:
            qs = qs.filter(subproject_id__in=visible_subproject_ids(user))

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
            # Non-recurring: span Start date (timeline_start) → Deadline so the task
            # shows on every day leading up to its due date. Single day if only one set.
            span_start = task.timeline_start or task.deadline
            span_end = task.deadline or task.timeline_start
            if not span_end:
                continue  # no dates → only in the list view, not the calendar
            if span_start > span_end:
                span_start, span_end = span_end, span_start
            d = max(span_start, start)
            last = min(span_end, end)
            while d <= last:
                out.append(_instance(task, d, today, is_deadline=(d == task.deadline)))
                d += timedelta(days=1)
        out.sort(key=lambda i: (i["date"], i["project_name"], i["title"]))
        return Response(out)
