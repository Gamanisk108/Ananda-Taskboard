"""Group-chat summary: a plain-text daily breakdown grouped BY PERSON
(alphabetical by first name), each with bullets of their tasks for the day +
deadlines, and a per-project emoji (color doesn't survive chat apps).

Filterable by projects, sub-projects, groups, and assignees. Respects the
caller's visibility.
"""

from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Group, User
from permissions.engine import visible_subproject_ids
from tasks.models import Task
from tasks.recurrence import occurrence_dates


def _ids(param):
    return [int(x) for x in (param or "").split(",") if x.strip().isdigit()]


def _on_date(task, day):
    """True if the task is active on `day`: recurring occurrence, or its span
    (start/creation → deadline) covers the day, or it's overdue and not done."""
    if task.is_recurring:
        return bool(occurrence_dates(task.recurrence_rule, day, day))
    end = task.deadline or task.timeline_start
    if not end:
        return False
    if task.deadline and task.deadline < day and task.status != Task.Status.DONE:
        return True  # overdue still shows
    start = task.timeline_start or (task.created_at.date() if (task.deadline and task.created_at) else end)
    if start > end:
        start, end = end, start
    return start <= day <= end


def _first_name(user):
    return (user.name or user.email).strip().split()[0] if (user.name or user.email).strip() else user.email


def build_summary_text(user, day, *, project_ids=None, subproject_ids=None, group_ids=None, assignee_ids=None):
    qs = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED)
        .select_related("subproject__project", "recurrence_rule")
        .prefetch_related("assignees", "assignee_groups")
    )
    if not user.is_admin:
        qs = qs.filter(subproject_id__in=visible_subproject_ids(user))
    if project_ids:
        qs = qs.filter(subproject__project_id__in=project_ids)
    if subproject_ids:
        qs = qs.filter(subproject_id__in=subproject_ids)

    # People to include (empty = everyone). Groups expand to their members.
    people_filter = set(assignee_ids or [])
    if group_ids:
        people_filter |= set(User.objects.filter(member_groups__id__in=group_ids).values_list("id", flat=True))
    restrict = bool(people_filter)

    users_by_id = {u.id: u for u in User.objects.filter(is_active=True)}
    per_person = defaultdict(list)   # user_id -> [(emoji, title, note)]
    unassigned = []

    for t in qs:
        if not _on_date(t, day):
            continue
        emoji = t.subproject.project.display_emoji
        overdue = bool(t.deadline and t.deadline < day and t.status != Task.Status.DONE)
        note = ""
        if t.deadline:
            note = f"overdue — was due {t.deadline.isoformat()}" if overdue else f"due {t.deadline.isoformat()}"
        line = (emoji, t.title, note)

        # who is it assigned to (direct + group members)
        ids = {u.id for u in t.assignees.all()}
        for g in t.assignee_groups.all():
            ids |= set(g.members.values_list("id", flat=True))
        if not ids:
            if not restrict:
                unassigned.append(line)
            continue
        for uid in ids:
            if restrict and uid not in people_filter:
                continue
            per_person[uid].append(line)

    # render
    header = f"📋 Tasks for {day.isoformat()}"
    sections = []
    ordered = sorted(
        (uid for uid in per_person if uid in users_by_id),
        key=lambda uid: _first_name(users_by_id[uid]).lower(),
    )
    for uid in ordered:
        u = users_by_id[uid]
        bullets = "\n".join(
            f"  • {emoji} {title}" + (f" — {note}" if note else "")
            for emoji, title, note in per_person[uid]
        )
        sections.append(f"*{u.name or u.email}*\n{bullets}")
    if unassigned:
        bullets = "\n".join(f"  • {e} {t}" + (f" — {n}" if n else "") for e, t, n in unassigned)
        sections.append(f"*Unassigned*\n{bullets}")

    if not sections:
        return f"{header}\nNothing scheduled. 🎉"
    return header + "\n\n" + "\n\n".join(sections)


class GroupChatSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        day_str = request.query_params.get("date")
        tz = settings.APP_TIMEZONE
        try:
            from notifications.daily import local_today
            default_day = local_today()
        except Exception:
            default_day = datetime.now(ZoneInfo(tz)).date()
        if day_str:
            try:
                day = datetime.strptime(day_str, "%Y-%m-%d").date()
            except ValueError:
                day = default_day
        else:
            day = default_day

        text = build_summary_text(
            request.user, day,
            project_ids=_ids(request.query_params.get("projects")),
            subproject_ids=_ids(request.query_params.get("subprojects")),
            group_ids=_ids(request.query_params.get("groups")),
            assignee_ids=_ids(request.query_params.get("assignees")),
        )
        return Response({"text": text})
