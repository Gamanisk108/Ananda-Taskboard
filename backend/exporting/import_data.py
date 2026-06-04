"""Task import: parse CSV / TSV / XLSX / JSON, preview (dry-run), then commit.

Round-trips the export format. Matching is by the `id` column: a row whose id
matches an existing task is an UPDATE (overwrite); rows without a known id are
CREATEs. Missing projects/sub-projects are auto-created. Assignees are matched to
existing users by email then name (never created). Admin-only (enforced at the
view) — so no per-task visibility checks are needed here.

Two phases share `_resolve_row` (pure, no writes): `preview` serializes the
resolutions; `commit` re-parses the same content and applies them under a
transaction, honouring per-row decisions (overwrite / create / skip).
"""

import csv
import io
import json
from datetime import datetime

from django.db import transaction

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import Status, Task

from .export import COLUMNS

MAX_ROWS = 5000
# columns we don't import (server-controlled or too complex to round-trip safely)
SKIP_COLUMNS = {"approval", "recurrence"}


# ── header mapping ──────────────────────────────────────────────────────────

def _col_key_for(header):
    """Map an incoming header (label OR key, any case) to a COLUMNS key."""
    h = (header or "").strip().lower()
    for key, (label, _) in COLUMNS.items():
        if h == key or h == label.lower():
            return key
    return None


# ── parsing ─────────────────────────────────────────────────────────────────

def parse(fmt, content):
    """Return a list of {col_key: str_value} dicts. `content` is text for
    csv/tsv/json, bytes for xlsx. Raises ValueError on malformed input."""
    fmt = (fmt or "csv").lower()
    if fmt == "json":
        return _parse_json(content)
    if fmt == "xlsx":
        return _parse_xlsx(content)
    return _parse_delimited(content, "\t" if fmt == "tsv" else _sniff_delim(content))


def _sniff_delim(text):
    first = (text or "").splitlines()[0] if text else ""
    return "\t" if ("\t" in first and first.count("\t") >= first.count(",")) else ","


def _rows_from_matrix(matrix):
    if not matrix:
        return []
    header_keys = [_col_key_for(h) for h in matrix[0]]
    out = []
    for raw in matrix[1:]:
        if not any((c or "").strip() for c in raw):
            continue  # skip blank lines
        row = {}
        for key, val in zip(header_keys, raw):
            if key and key not in SKIP_COLUMNS:
                row[key] = "" if val is None else str(val).strip()
        out.append(row)
    return out


def _parse_delimited(text, delimiter):
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    return _rows_from_matrix(list(reader))


def _parse_xlsx(content):
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    matrix = [[c if c is not None else "" for c in row] for row in ws.iter_rows(values_only=True)]
    return _rows_from_matrix(matrix)


def _parse_json(text):
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("JSON import must be a list of task objects.")
    out = []
    for obj in data:
        if not isinstance(obj, dict):
            raise ValueError("Each JSON item must be an object.")
        row = {}
        for k, v in obj.items():
            key = _col_key_for(k)
            if key and key not in SKIP_COLUMNS:
                row[key] = "" if v is None else str(v).strip()
        out.append(row)
    return out


# ── value coercion ──────────────────────────────────────────────────────────

def _parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"bad date '{s}' (use YYYY-MM-DD)")


def _parse_time(s):
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"bad time '{s}' (use HH:MM)")


_PRIORITY_LABELS = {"lowest": 1, "low": 2, "medium": 3, "high": 4, "highest": 5}


def _parse_priority(s):
    s = (s or "").strip().lower()
    if not s:
        return 3
    if s.isdigit() and 1 <= int(s) <= 5:
        return int(s)
    if s in _PRIORITY_LABELS:
        return _PRIORITY_LABELS[s]
    raise ValueError(f"bad priority '{s}'")


def _status_maps():
    by = {}
    for st in Status.objects.all():
        by[st.key.lower()] = st.key
        by[st.label.lower()] = st.key
    initial = (
        Status.objects.filter(is_initial=True).values_list("key", flat=True).first()
        or Status.objects.order_by("order", "id").values_list("key", flat=True).first()
        or "todo"
    )
    return by, initial


def _user_maps():
    by_email, by_name = {}, {}
    for u in User.objects.filter(is_active=True):
        by_email[u.email.lower()] = u.id
        if u.name:
            by_name.setdefault(u.name.lower(), u.id)
    return by_email, by_name


def _parse_links(s):
    return [p for p in (s or "").replace(",", " ").split() if p]


# ── resolution (pure: no DB writes) ───────────────────────────────────────────

class Ctx:
    """Caches the lookups the resolver needs, built once per preview/commit."""

    def __init__(self):
        self.projects = {p.name.lower(): p for p in Project.objects.all()}
        self.subs = {}
        for sp in SubProject.objects.select_related("project").all():
            self.subs[(sp.project.name.lower(), sp.name.lower())] = sp
        self.status_map, self.initial_status = _status_maps()
        self.email_map, self.name_map = _user_maps()


def _resolve_row(row, ctx):
    """Compute a row's resolution. Returns a dict with action/errors/warnings and
    the parsed field values (no DB writes)."""
    r = {"errors": [], "warnings": [], "fields": {}, "assignee_ids": [],
         "will_create_project": False, "will_create_subproject": False}

    title = (row.get("title") or "").strip()
    if not title:
        r["errors"].append("Title is required")
    r["title"] = title

    project_name = (row.get("project") or "").strip()
    sub_name = (row.get("subproject") or "").strip() or "General"
    r["project"], r["subproject"] = project_name, sub_name
    if not project_name:
        r["errors"].append("Project is required")
    else:
        if project_name.lower() not in ctx.projects:
            r["will_create_project"] = True
            r["will_create_subproject"] = sub_name.lower() != "general"
        elif (project_name.lower(), sub_name.lower()) not in ctx.subs:
            r["will_create_subproject"] = True

    # id matching → action
    raw_id = (row.get("id") or "").strip()
    r["match_id"] = None
    if raw_id:
        if raw_id.isdigit() and Task.objects.filter(pk=int(raw_id)).exists():
            r["match_id"] = int(raw_id)
        elif raw_id.isdigit():
            r["warnings"].append(f"ID {raw_id} not found — will create new")
        else:
            r["warnings"].append(f"ignoring non-numeric ID '{raw_id}'")
    r["action"] = "update" if r["match_id"] else "create"

    # scalar fields
    fields = r["fields"]
    fields["details"] = (row.get("details") or "").strip()
    fields["requirements"] = (row.get("requirements") or "").strip()
    fields["links"] = _parse_links(row.get("links"))
    try:
        fields["deadline"] = _parse_date(row.get("deadline"))
    except ValueError as e:
        r["errors"].append(str(e))
    try:
        st = _parse_time(row.get("start_time"))
        et = _parse_time(row.get("end_time"))
        if bool(st) != bool(et):
            r["errors"].append("set both start and end time, or neither")
        elif st and et and et <= st:
            r["errors"].append("end time must be after start time")
        fields["start_time"], fields["end_time"] = st, et
    except ValueError as e:
        r["errors"].append(str(e))
    try:
        fields["priority"] = _parse_priority(row.get("priority"))
    except ValueError as e:
        r["errors"].append(str(e))

    raw_status = (row.get("status") or "").strip().lower()
    if raw_status and raw_status in ctx.status_map:
        fields["status"] = ctx.status_map[raw_status]
    elif raw_status:
        r["warnings"].append(f"unknown status '{row.get('status')}' — using default")
        fields["status"] = ctx.initial_status
    else:
        fields["status"] = ctx.initial_status

    # assignees: match by email then name; collect unmatched
    raw_assignees = (row.get("assignees") or "").replace(";", ",")
    for part in [p.strip() for p in raw_assignees.split(",") if p.strip()]:
        uid = ctx.email_map.get(part.lower()) or ctx.name_map.get(part.lower())
        if uid:
            r["assignee_ids"].append(uid)
        else:
            r["warnings"].append(f"no user matched '{part}' — left unassigned")

    return r


# ── preview & commit ───────────────────────────────────────────────────────

def preview(rows):
    if len(rows) > MAX_ROWS:
        raise ValueError(f"Too many rows ({len(rows)}); max {MAX_ROWS}.")
    ctx = Ctx()
    out, new_projects, new_subs = [], set(), set()
    counts = {"create": 0, "update": 0, "error": 0}
    for i, row in enumerate(rows):
        res = _resolve_row(row, ctx)
        if res["will_create_project"]:
            new_projects.add(res["project"])
        if res["will_create_subproject"]:
            new_subs.add(f"{res['project']} / {res['subproject']}")
        action = "error" if res["errors"] else res["action"]
        counts[action] = counts.get(action, 0) + 1
        out.append({
            "row": i, "action": action, "match_id": res["match_id"], "title": res["title"],
            "project": res["project"], "subproject": res["subproject"],
            "will_create_project": res["will_create_project"],
            "will_create_subproject": res["will_create_subproject"],
            "errors": res["errors"], "warnings": res["warnings"],
        })
    return {
        "rows": out,
        "new_projects": sorted(new_projects),
        "new_subprojects": sorted(new_subs),
        "summary": counts,
        "total": len(rows),
    }


@transaction.atomic
def commit(user, rows, decisions):
    """Apply the import. `decisions` maps str(row_index) -> overwrite|create|skip;
    a missing entry follows the row's natural action. Rows with errors are skipped."""
    if len(rows) > MAX_ROWS:
        raise ValueError(f"Too many rows ({len(rows)}); max {MAX_ROWS}.")
    ctx = Ctx()
    proj_cache = dict(ctx.projects)   # name.lower() -> Project (live, grows as we create)
    sub_cache = dict(ctx.subs)
    result = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    def get_project(name):
        p = proj_cache.get(name.lower())
        if p is None:
            p = Project.objects.create(name=name)  # color + default 'General' auto-created
            proj_cache[name.lower()] = p
            for sp in p.subprojects.all():
                sub_cache[(name.lower(), sp.name.lower())] = sp
        return p

    def get_sub(pname, sname):
        key = (pname.lower(), sname.lower())
        sp = sub_cache.get(key)
        if sp is None:
            sp = SubProject.objects.create(project=get_project(pname), name=sname)
            sub_cache[key] = sp
        return sp

    for i, row in enumerate(rows):
        res = _resolve_row(row, ctx)
        decision = decisions.get(str(i))
        if res["errors"]:
            result["errors"] += 1
            continue
        if decision == "skip":
            result["skipped"] += 1
            continue

        sub = get_sub(res["project"], res["subproject"])
        f = res["fields"]
        as_update = res["action"] == "update" and decision != "create"

        if as_update:
            task = Task.objects.filter(pk=res["match_id"]).first()
            if task is None:  # vanished between preview and commit
                as_update = False
        if as_update:
            task.subproject = sub
            task.title = res["title"]
            for k, v in f.items():
                setattr(task, k, v)
            task.save()
            task.assignees.set(res["assignee_ids"])
            result["updated"] += 1
        else:
            task = Task(subproject=sub, title=res["title"], created_by=user,
                        approval_state=Task.Approval.APPROVED, **f)
            task.save()
            task.assignees.set(res["assignee_ids"])
            result["created"] += 1

    return result
