"""Claude (Haiku) task proposal: turn a free-text request + document text/images
into a validated list of proposed tasks mapped to the org's real projects, sub-
projects, and members.

The raw model call is isolated in `_call_model` so tests patch that one function;
`propose_tasks` owns prompt assembly + strict validation of the model's output
against the caller's actual org data (the model can hallucinate ids — we drop any
that don't belong to this org).
"""

from django.conf import settings

# Anthropic tool schema — forces structured output (no free-text parsing).
EMIT_TASKS_TOOL = {
    "name": "emit_tasks",
    "description": "Return the to-do tasks extracted from the user's request and any documents/images.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Short imperative task name."},
                        "priority": {"type": "integer", "description": "1 lowest … 5 highest. Default 3."},
                        "project_id": {"type": ["integer", "null"], "description": "An existing project id, or null."},
                        "subproject_id": {"type": ["integer", "null"], "description": "An existing sub-project id within that project, or null."},
                        "assignee_ids": {"type": "array", "items": {"type": "integer"}, "description": "Existing member ids this task suits, or empty."},
                        "new_project": {"type": ["string", "null"], "description": "Only if NO existing project fits: a proposed new project name. Rare."},
                        "source_file_index": {"type": ["integer", "null"], "description": "0-based index of the uploaded file this task came from, or null."},
                        "subtasks": {"type": "array", "items": {"type": "string"}, "description": "If this task naturally breaks into smaller steps, the subtask titles (short, imperative). Otherwise omit or leave empty."},
                        "start_date": {"type": ["string", "null"], "description": "Start date YYYY-MM-DD if the work begins on a specific day; else null. For a recurring task, the first occurrence."},
                        "deadline": {"type": ["string", "null"], "description": "Due date YYYY-MM-DD if one is stated/implied; else null."},
                        "recurrence": {
                            "type": ["object", "null"],
                            "description": "If the task repeats on a schedule, the rule; else null. Steps done each occurrence go in subtasks (do NOT enumerate per occurrence).",
                            "properties": {
                                "freq": {"type": "string", "enum": ["daily", "weekly", "monthly", "yearly"]},
                                "interval": {"type": "integer", "description": "Every N units (default 1)."},
                                "weekdays": {"type": "array", "items": {"type": "integer"}, "description": "Weekly only: Mon=0 … Sun=6 (Saturday=5)."},
                                "anchor": {"type": ["string", "null"], "description": "First occurrence date, YYYY-MM-DD."},
                                "count": {"type": ["integer", "null"], "description": "Number of occurrences, if stated (e.g. 'for 8 weeks' → 8)."},
                                "end_date": {"type": ["string", "null"], "description": "Last date YYYY-MM-DD, if stated instead of a count."},
                            },
                        },
                    },
                    "required": ["title"],
                },
            },
        },
        "required": ["tasks"],
    },
}


def _client():
    import anthropic
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _call_model(system: str, content_blocks: list) -> dict:
    """Raw Haiku call → the emit_tasks tool input dict. Patched in tests."""
    resp = _client().messages.create(
        model=settings.AI_MODEL,
        max_tokens=4096,
        system=system,
        tools=[EMIT_TASKS_TOOL],
        tool_choice={"type": "tool", "name": "emit_tasks"},
        messages=[{"role": "user", "content": content_blocks}],
    )
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == "emit_tasks":
            return block.input or {"tasks": []}
    return {"tasks": []}


def _build_system(projects, members, today="") -> str:
    proj_lines = []
    for p in projects:
        subs = ", ".join(f"{s['name']} (sub#{s['id']})" for s in p.get("subprojects", []))
        proj_lines.append(f"- {p['name']} (project#{p['id']}) → sub-projects: {subs or 'none'}")
    member_lines = [f"- {m['name']} (user#{m['id']})" for m in members]
    return (
        "You turn a request and any attached documents/images into concrete to-do tasks "
        "for a team task board. Rules:\n"
        "- Each task: a short imperative title, a priority 1 (low) to 5 (high), and assign it "
        "to the MOST fitting EXISTING project + sub-project below using their numeric ids.\n"
        "- Only propose a new_project name in rare cases where nothing existing fits; never invent ids.\n"
        "- Suggest assignee_ids from the member list when the work clearly suits someone; else leave empty.\n"
        "- If a task came from a specific uploaded file, set source_file_index to that file's index.\n"
        "- GROUP related work. When the user names a deliverable/goal and then the steps "
        "to achieve it, emit ONE task for the deliverable with those steps as its subtasks "
        "— do NOT make each step its own top-level task. Example: “get the website up: set "
        "up Shopify, get SKUs from Bryan, answer the questionnaire, lock the design” → one "
        "task “Website setup” with subtasks [“Set up Shopify account”, “Get SKUs from Bryan”, "
        "“Answer brainstorm questionnaire”, “Lock design”]. Only emit separate top-level tasks "
        "for genuinely separate deliverables. A short list of distinct, unrelated to-dos (e.g. "
        "“set up the bedrooms, help them move in, fix the balcony door”) stays as separate tasks.\n"
        "- Capture dates: if a task has a due date set deadline (YYYY-MM-DD); if it starts "
        "on a specific day set start_date. Resolve relative dates against TODAY below.\n"
        "- If a task REPEATS on a schedule (e.g. “every Saturday for 8 weeks”), set its "
        "recurrence (weekdays use Mon=0 … Sun=6, so Saturday=5; “for 8 weeks” → count 8) and "
        "compute a concrete anchor date. Put the steps done EACH occurrence in subtasks — do "
        "NOT create one subtask per week. Else leave recurrence null.\n"
        "- Do not duplicate tasks. Be concise and practical.\n\n"
        + (f"TODAY IS {today}. Resolve relative dates (e.g. '2nd week of July') against it.\n\n" if today else "")
        + f"EXISTING PROJECTS / SUB-PROJECTS:\n{chr(10).join(proj_lines) or '(none)'}\n\n"
        f"TEAM MEMBERS:\n{chr(10).join(member_lines) or '(none)'}"
    )


import re

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _valid_recurrence(rec, today=""):
    """Coerce the model's recurrence to the app's shape, or None. Anchor defaults to
    today when the rule is present but no first date was given."""
    if not isinstance(rec, dict):
        return None
    if rec.get("freq") not in ("daily", "weekly", "monthly", "yearly"):
        return None
    try:
        interval = max(1, int(rec.get("interval") or 1))
    except (TypeError, ValueError):
        interval = 1
    wd = rec.get("weekdays")
    weekdays = [d for d in wd if isinstance(d, int) and 0 <= d <= 6] if isinstance(wd, (list, tuple)) else []
    anchor = rec.get("anchor") if isinstance(rec.get("anchor"), str) and _DATE_RE.match(rec.get("anchor") or "") else None
    end_date = rec.get("end_date") if isinstance(rec.get("end_date"), str) and _DATE_RE.match(rec.get("end_date") or "") else None
    count = rec.get("count")
    count = count if isinstance(count, int) and count > 0 else None
    return {
        "freq": rec["freq"], "interval": interval,
        "weekdays": weekdays if rec["freq"] == "weekly" else [],
        "anchor": anchor or (today or None), "end_date": end_date, "count": count,
    }


def _validate(raw: dict, projects, members, n_files: int, today="") -> dict:
    """Drop anything the model hallucinated: ids must belong to this org; a sub-project
    must belong to its stated project; priority clamps to 1–5; tasks cap at AI_MAX_TASKS."""
    valid_proj = {p["id"] for p in projects}
    sub_to_proj = {s["id"]: p["id"] for p in projects for s in p.get("subprojects", [])}
    valid_members = {m["id"] for m in members}
    out = []
    for t in (raw or {}).get("tasks", []):
        title = (t.get("title") or "").strip()
        if not title:
            continue
        try:
            pr = int(t.get("priority") or 3)
        except (TypeError, ValueError):
            pr = 3
        else:
            pr = min(5, max(1, pr))
        proj = t.get("project_id") if t.get("project_id") in valid_proj else None
        sub = t.get("subproject_id")
        if sub not in sub_to_proj or (proj is not None and sub_to_proj.get(sub) != proj):
            sub = None
        if proj is None and sub is not None:           # sub implies its project
            proj = sub_to_proj.get(sub)
        raw_assignees = t.get("assignee_ids")
        if not isinstance(raw_assignees, (list, tuple)):
            raw_assignees = []
        assignees = [a for a in raw_assignees if isinstance(a, int) and a in valid_members]
        new_project = ((t.get("new_project") or "").strip()[:100]) or None
        if proj is not None:
            new_project = None                          # existing project wins
        sfi = t.get("source_file_index")
        if not isinstance(sfi, int) or not (0 <= sfi < n_files):
            sfi = None
        raw_subs = t.get("subtasks")
        if not isinstance(raw_subs, (list, tuple)):
            raw_subs = []
        subtasks = [s.strip()[:300] for s in raw_subs if isinstance(s, str) and s.strip()][:20]
        rec = _valid_recurrence(t.get("recurrence"), today)
        start = t.get("start_date") if isinstance(t.get("start_date"), str) and _DATE_RE.match(t.get("start_date") or "") else None
        deadline = t.get("deadline") if isinstance(t.get("deadline"), str) and _DATE_RE.match(t.get("deadline") or "") else None
        if rec and not start:
            start = rec.get("anchor")     # recurring task starts on its first occurrence
        out.append({
            "title": title[:200], "priority": pr, "project_id": proj, "subproject_id": sub,
            "assignee_ids": assignees, "new_project": new_project, "source_file_index": sfi,
            "subtasks": subtasks, "recurrence": rec, "start_date": start, "deadline": deadline,
        })
    capped = out[: settings.AI_MAX_TASKS]
    return {"tasks": capped, "truncated": len(out) > len(capped)}


def propose_tasks(prompt, documents, projects, members, images=None, n_files=0, today=""):
    """documents: [(filename, text)]; images: [(index, media_type, b64)];
    projects: [{id,name,subprojects:[{id,name}]}]; members: [{id,name}].
    Returns {"tasks": [...], "truncated": bool}."""
    blocks = []
    user_text = (prompt or "").strip() or "Generate to-do tasks from the attached documents."
    blocks.append({"type": "text", "text": user_text})
    for fname, text in documents:
        if text:
            blocks.append({"type": "text", "text": f"\n--- Document: {fname} ---\n{text[:20000]}"})
    for _idx, media_type, b64 in (images or []):
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})
    raw = _call_model(_build_system(projects, members, today), blocks)
    return _validate(raw, projects, members, n_files, today)
