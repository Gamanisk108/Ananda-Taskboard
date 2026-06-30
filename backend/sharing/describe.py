"""Turn any shareable object (Project / Sub-project / Task / Sub-task) into a
uniform `CardSpec` used by BOTH the card image (card.py) and the OG meta tags
(public_views.py). One adapter = one source of truth for what a share shows.

Also exposes org resolution + a permission check, so the API mints a link only
for an object the requester can actually see.
"""

from __future__ import annotations

from projects.models import Project, SubProject
from tasks.models import Subtask, Task

from .card import CardSpec

ARROW = " › "  # U+203A - matches the app ChevronRight breadcrumb separator


def _display_name(user) -> str:
    name = (getattr(user, "name", "") or "").strip()
    # On a PUBLIC card we never fall back to the email local-part — that would
    # leak a personal identifier to anyone with the link.
    return name or "Someone"


def _assignee_names(obj) -> list[str]:
    return [_display_name(u) for u in obj.assignees.all()]


# ── org resolution (every object resolves to exactly one tenant) ────────────────

def org_of(obj):
    if isinstance(obj, Task):
        return obj.subproject.project.organization
    if isinstance(obj, Subtask):
        return obj.task.subproject.project.organization
    if isinstance(obj, SubProject):
        return obj.project.organization
    if isinstance(obj, Project):
        return obj.organization
    return None


def _dead(x) -> bool:
    return getattr(x, "deleted_at", None) is not None


def is_live(obj) -> bool:
    """False if the object OR any ancestor is soft-deleted — a share of deleted
    work must 410, not leak a tombstone."""
    if isinstance(obj, Task):
        return not _dead(obj) and not _dead(obj.subproject) and not _dead(obj.subproject.project)
    if isinstance(obj, Subtask):
        t = obj.task
        return (not _dead(obj) and not _dead(t) and not _dead(t.subproject)
                and not _dead(t.subproject.project))
    if isinstance(obj, SubProject):
        return not _dead(obj) and not _dead(obj.project)
    if isinstance(obj, Project):
        return not _dead(obj)
    return False


def can_view(user, obj, org) -> bool:
    """True if `user` may see `obj` in `org` — reuses the permission engine so a
    share link can never expose more than the app would."""
    from permissions.engine import access_map, can_see_task, visible_project_ids

    if isinstance(obj, Task):
        return can_see_task(user, obj, org)
    if isinstance(obj, Subtask):
        return can_see_task(user, obj.task, org)
    if isinstance(obj, SubProject):
        return obj.id in access_map(user, org)
    if isinstance(obj, Project):
        return obj.id in visible_project_ids(user, org)
    return False


# ── the adapter ─────────────────────────────────────────────────────────────

def describe(obj) -> CardSpec:
    if isinstance(obj, Task):
        sp = obj.subproject
        proj = sp.project
        crumb = proj.name if sp.is_default else f"{proj.name}{ARROW}{sp.name}"
        return CardSpec(
            kind="Task", title=obj.title, breadcrumb=crumb, description=obj.details,
            priority=obj.priority, status=obj.status, assignees=_assignee_names(obj),
            accent=sp.color or proj.color or "#1e3a6e", deep_link=f"/?task={obj.id}",
        )
    if isinstance(obj, Subtask):
        task = obj.task
        sp = task.subproject
        proj = sp.project
        head = proj.name if sp.is_default else f"{proj.name}{ARROW}{sp.name}"
        return CardSpec(
            kind="Sub-task", title=obj.title, breadcrumb=f"{head}{ARROW}{task.title}",
            description=obj.details, priority=obj.priority, status=obj.status,
            assignees=_assignee_names(obj), accent=sp.color or proj.color or "#1e3a6e",
            deep_link=f"/?task={task.id}",
        )
    if isinstance(obj, SubProject):
        proj = obj.project
        return CardSpec(
            kind="Sub-project", title=obj.name, breadcrumb=proj.name,
            description=obj.description, accent=obj.color or proj.color or "#1e3a6e",
            deep_link=f"/?project={proj.id}&sub={obj.id}",
        )
    if isinstance(obj, Project):
        return CardSpec(
            kind="Project", title=obj.name, breadcrumb=org_of(obj).name if org_of(obj) else "",
            description=obj.description, accent=obj.color or "#1e3a6e",
            deep_link=f"/?project={obj.id}",
        )
    raise TypeError(f"Not shareable: {obj!r}")


# ── full read-only DETAIL (the public /s/<token> page, not the card image) ──────
# Shows the task's text plainly so anyone with the link can READ it without an
# account. NO comments/attachments (Gordon 2026-06-29 — those stay members-only).

def _initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (name.strip()[:2] or "?").upper()


def _status_meta(key):
    from . import brand
    if key in brand.STATUS:
        label, color = brand.STATUS[key]
        return {"label": label, "color": color}
    return None


def _priority_meta(level):
    from . import brand
    if level in brand.PRIORITY:
        label, color = brand.PRIORITY[level]
        return {"label": label, "color": color}
    return None


def _fmt_date(d):
    return f"{d:%b} {d.day}, {d.year}" if d else None  # cross-platform (no %-d)


def _fmt_time(tm):
    return tm.strftime("%I:%M %p").lstrip("0") if tm else None


def _assignee_chips(obj):
    return [{"name": n, "initials": _initials(n)} for n in _assignee_names(obj)]


def _subtask_rows(task):
    rows = []
    for s in task.subtasks.all().order_by("order", "id"):
        rows.append({
            "title": s.title,
            "status": _status_meta(s.status),
            "priority": _priority_meta(s.priority),
            "assignees": _assignee_chips(s),
        })
    return rows


def detail(obj, *, include_description: bool = True) -> dict:
    """A template-ready context for the full read-only page. `include_description`
    (the per-link toggle) gates the free-text body (description + requirements);
    structured fields always show."""
    spec = describe(obj)
    d = {
        "kind": spec.kind,
        "title": spec.title,
        "breadcrumb": spec.breadcrumb,
        "accent": spec.accent,
        "deep_link": spec.deep_link,
        "status": _status_meta(spec.status),
        "priority": _priority_meta(spec.priority),
        "assignees": [],
        "description": "",
        "requirements": "",
        "deadline": None, "start_date": None, "start_time": None, "end_time": None,
        "links": [],
        "subtasks": [],
        "object_id": obj.id,
    }
    if isinstance(obj, (Task, Subtask)):
        d["assignees"] = _assignee_chips(obj)
        if include_description:
            d["description"] = obj.details
            d["requirements"] = obj.requirements
        d["deadline"] = _fmt_date(obj.deadline)
        d["start_date"] = _fmt_date(obj.timeline_start)
        d["start_time"] = _fmt_time(obj.start_time)
        d["end_time"] = _fmt_time(obj.end_time)
        # Only http(s) links — a public page must never render a javascript: href.
        d["links"] = [
            u.strip() for u in (obj.links or [])
            if isinstance(u, str) and u.strip().lower().startswith(("http://", "https://"))
        ]
    if isinstance(obj, Task):
        d["object_id"] = obj.id
        d["subtasks"] = _subtask_rows(obj)
    if isinstance(obj, (Project, SubProject)) and include_description:
        d["description"] = obj.description
    return d
