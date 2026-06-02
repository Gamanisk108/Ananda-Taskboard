"""CSV / XLSX export of the current view's tasks.

Permission-filtered (never includes hidden sub-projects), level-aware (admins all,
others their visible sub-projects), approved-only. CSV cells are sanitized against
formula injection (leading = + - @ or control chars). An empty result still
produces a valid file with a header row.
"""

import csv
import io

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from permissions.engine import visible_subproject_ids
from tasks.models import Task

HEADERS = [
    "Project", "Sub-project", "Title", "Status", "Approval", "Deadline",
    "Recurrence", "Assignees", "Details", "Requirements", "Links",
]

_DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def sanitize_csv(value):
    """Neutralize CSV formula injection: prefix risky cells with a single quote.
    (Leading =, +, -, @ or control chars are how spreadsheet formulas start.)"""
    s = "" if value is None else str(value)
    if s and (s[0] in _DANGEROUS_PREFIXES or s[0] in ("\t", "\r", "\n")):
        return "'" + s
    return s


def _queryset(user, params):
    qs = (
        Task.objects.filter(approval_state=Task.Approval.APPROVED)
        .select_related("subproject__project", "recurrence_rule")
        .prefetch_related("assignees")
    )
    if not user.is_admin:
        qs = qs.filter(subproject_id__in=visible_subproject_ids(user))
    if params.get("subproject"):
        qs = qs.filter(subproject_id=params["subproject"])
    elif params.get("project"):
        qs = qs.filter(subproject__project_id=params["project"])
    if params.get("status"):
        qs = qs.filter(status=params["status"])
    return qs.order_by("subproject__project__name", "subproject__name", "title")


def _row(task):
    rr = task.recurrence_rule
    return [
        task.subproject.project.name,
        task.subproject.name,
        task.title,
        task.get_status_display(),
        task.get_approval_state_display(),
        task.deadline.isoformat() if task.deadline else "",
        f"every {rr.interval} {rr.freq}" if rr else "",
        ", ".join(a.name or a.email for a in task.assignees.all()),
        task.details,
        task.requirements,
        " ".join(task.links or []),
    ]


class ExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fmt = request.query_params.get("fmt", "csv").lower()
        tasks = list(_queryset(request.user, request.query_params))
        if fmt == "xlsx":
            return self._xlsx(tasks)
        return self._csv(tasks)

    def _csv(self, tasks):
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(HEADERS)  # header row always present (valid even if empty)
        for t in tasks:
            writer.writerow([sanitize_csv(c) for c in _row(t)])
        resp = HttpResponse(buf.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="tasks.csv"'
        return resp

    def _xlsx(self, tasks):
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "Tasks"
        ws.append(HEADERS)
        for t in tasks:
            # XLSX isn't formula-vulnerable the same way, but stay consistent.
            ws.append([sanitize_csv(c) for c in _row(t)])
        out = io.BytesIO()
        wb.save(out)
        resp = HttpResponse(
            out.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = 'attachment; filename="tasks.xlsx"'
        return resp
