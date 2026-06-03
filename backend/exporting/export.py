"""CSV / XLSX export of tasks, with scope, filters, and column selection.

Permission-filtered (never includes hidden sub-projects), level-aware (admins all,
others their visible sub-projects), approved-only. CSV cells are sanitized against
formula injection (leading = + - @ or control chars). An empty result still
produces a valid file with a header row.

Query params:
  fmt=csv|xlsx
  project / subproject  -> scope (omit both = entire visible board)
  status                -> a status key
  assignee              -> a user id, or "unassigned"
  priority              -> 1..5
  archived=1            -> include archived tasks (default: exclude)
  columns               -> comma-separated column keys (default: all, in order)
"""

import csv
import io
from collections import OrderedDict

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from permissions.engine import visible_subproject_ids
from tasks.models import Task

_DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def _rr_text(task):
    rr = task.recurrence_rule
    if not rr:
        return ""
    if rr.freq == "weekly" and rr.weekdays:
        return f"weekly on weekdays {rr.weekdays}"
    return f"every {rr.interval} {rr.freq}"


# key -> (header, value-getter). Order here is the default column order.
COLUMNS = OrderedDict([
    ("project", ("Project", lambda t: t.subproject.project.name)),
    ("subproject", ("Sub-project", lambda t: t.subproject.name)),
    ("title", ("Title", lambda t: t.title)),
    ("status", ("Status", lambda t: t.get_status_display())),
    ("priority", ("Priority", lambda t: t.get_priority_display())),
    ("approval", ("Approval", lambda t: t.get_approval_state_display())),
    ("deadline", ("Deadline", lambda t: t.deadline.isoformat() if t.deadline else "")),
    ("start_time", ("Start time", lambda t: t.start_time.strftime("%H:%M") if t.start_time else "")),
    ("end_time", ("End time", lambda t: t.end_time.strftime("%H:%M") if t.end_time else "")),
    ("recurrence", ("Recurrence", _rr_text)),
    ("assignees", ("Assignees", lambda t: ", ".join(a.name or a.email for a in t.assignees.all()))),
    ("details", ("Details", lambda t: t.details)),
    ("requirements", ("Requirements", lambda t: t.requirements)),
    ("links", ("Links", lambda t: " ".join(t.links or []))),
])


def sanitize_csv(value):
    """Neutralize CSV formula injection: prefix risky cells with a single quote."""
    s = "" if value is None else str(value)
    if s and (s[0] in _DANGEROUS_PREFIXES or s[0] in ("\t", "\r", "\n")):
        return "'" + s
    return s


def _selected_columns(params):
    raw = params.get("columns")
    if not raw:
        return list(COLUMNS.keys())
    picked = [k for k in raw.split(",") if k in COLUMNS]
    return picked or list(COLUMNS.keys())


def _queryset(user, params):
    qs = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED)
        .select_related("subproject__project", "recurrence_rule")
        .prefetch_related("assignees")
    )
    if not user.is_admin:
        qs = qs.filter(subproject_id__in=visible_subproject_ids(user))
    if params.get("archived") not in ("1", "true", "True"):
        qs = qs.filter(archived_at__isnull=True)
    if params.get("subproject"):
        qs = qs.filter(subproject_id=params["subproject"])
    elif params.get("project"):
        qs = qs.filter(subproject__project_id=params["project"])
    if params.get("status"):
        qs = qs.filter(status=params["status"])
    if params.get("priority"):
        qs = qs.filter(priority=params["priority"])
    assignee = params.get("assignee")
    if assignee == "unassigned":
        qs = qs.filter(assignees__isnull=True)
    elif assignee:
        qs = qs.filter(assignees__id=assignee)
    return qs.order_by("subproject__project__name", "subproject__name", "title").distinct()


class ExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fmt = request.query_params.get("fmt", "csv").lower()
        cols = _selected_columns(request.query_params)
        headers = [COLUMNS[k][0] for k in cols]
        getters = [COLUMNS[k][1] for k in cols]
        tasks = list(_queryset(request.user, request.query_params))
        rows = [[sanitize_csv(get(t)) for get in getters] for t in tasks]
        return self._xlsx(headers, rows) if fmt == "xlsx" else self._csv(headers, rows)

    def _csv(self, headers, rows):
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerows(rows)
        resp = HttpResponse(buf.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="tasks.csv"'
        return resp

    def _xlsx(self, headers, rows):
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "Tasks"
        ws.append(headers)
        for r in rows:
            ws.append(r)
        out = io.BytesIO()
        wb.save(out)
        resp = HttpResponse(
            out.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = 'attachment; filename="tasks.xlsx"'
        return resp
