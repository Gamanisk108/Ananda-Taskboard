"""Calendar/timeline endpoint: expands tasks into dated instances within a window
for the weekly and monthly views. Non-recurring tasks appear on their deadline;
recurring tasks appear once per generated occurrence. Visibility + approved-only
are enforced; overdue is flagged."""

from datetime import date, datetime

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


def _instance(task, on_date, today):
    sp = task.subproject
    proj = sp.project
    return {
        "task_id": task.id,
        "title": task.title,
        "date": on_date.isoformat(),
        "status": task.status,
        "is_recurring": task.is_recurring,
        "subproject_id": sp.id,
        "subproject_name": sp.name,
        "subproject_color": sp.color,
        "project_id": proj.id,
        "project_name": proj.name,
        "project_color": proj.color,
        "overdue": on_date < today and task.status != Task.Status.DONE,
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
                for d in occurrence_dates(task.recurrence_rule, start, end):
                    out.append(_instance(task, d, today))
            elif task.deadline and start <= task.deadline <= end:
                out.append(_instance(task, task.deadline, today))
        out.sort(key=lambda i: (i["date"], i["project_name"], i["title"]))
        return Response(out)
