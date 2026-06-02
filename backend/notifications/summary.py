"""Group-chat summary: a plain-text daily breakdown grouped Project → Sub-project
→ task (with assignees), formatted to paste straight into WhatsApp/Slack. Respects
the caller's visibility."""

from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from permissions.engine import visible_subproject_ids
from tasks.models import Task
from tasks.recurrence import occurrence_dates


def _on_date(task, day):
    if task.is_recurring:
        return bool(occurrence_dates(task.recurrence_rule, day, day))
    return task.deadline == day


def build_summary_text(user, day):
    qs = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED)
        .select_related("subproject__project", "recurrence_rule")
        .prefetch_related("assignees")
    )
    if not user.is_admin:
        qs = qs.filter(subproject_id__in=visible_subproject_ids(user))

    # group: project name -> subproject name -> [lines]
    grouped = defaultdict(lambda: defaultdict(list))
    for t in qs:
        overdue = (not t.is_recurring and t.deadline and t.deadline < day and t.status != Task.Status.DONE)
        if not (_on_date(t, day) or overdue):
            continue
        who = ", ".join(a.name or a.email for a in t.assignees.all()) or "unassigned"
        tag = " (OVERDUE)" if overdue else ""
        grouped[t.subproject.project.name][t.subproject.name].append(
            f"  • {t.title} — {who} [{t.get_status_display()}]{tag}"
        )

    header = f"📋 Tasks for {day.isoformat()}"
    if not grouped:
        return f"{header}\nNothing scheduled. 🎉"
    out = [header]
    for project in sorted(grouped):
        out.append(f"\n*{project}*")
        for sub in sorted(grouped[project]):
            out.append(f" {sub}:")
            out.extend(grouped[project][sub])
    return "\n".join(out)


class GroupChatSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        day_str = request.query_params.get("date")
        if day_str:
            try:
                day = datetime.strptime(day_str, "%Y-%m-%d").date()
            except ValueError:
                day = datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()
        else:
            day = datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()
        return Response({"text": build_summary_text(request.user, day)})
