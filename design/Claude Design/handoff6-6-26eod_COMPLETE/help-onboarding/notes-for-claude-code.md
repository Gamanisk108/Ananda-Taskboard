# Notes for Claude Code — logged during design review

Behavior/spec items raised during the Help / Subtasks / Unscheduled design pass that
are **logic, not visual** — recorded here so they aren't lost.

## Time requires a date (validation)
- A task (or subtask) should **not be able to have a start/end time without also having a
  date**. Times are meaningless without a day to anchor them.
- Consequently, **Unscheduled tasks never have a time** — the "Unscheduled tasks" modal's
  sort control therefore offers only **A–Z** and **Status** (no "Time" sort), and its rows
  never show a time / "All day" label.
- Existing both-or-neither time validation should be extended: block saving a time unless a
  date (start date or deadline) is present.

## Compact task row (day-detail & Unscheduled list) — canonical field order
`Priority icon · Task · Project pill · Sub-project pill · (time, only if set) · Assignee
initials · Status pill`. No bare project color swatch; projects/sub-projects are **pills**.

## Weekly task-bar corner radius — intentional deviation
- The Weekly view's task bars use a **softened 5px corner radius** here, by request — this is
  a deliberate departure from the app's current fully-rounded pill bars. Apply 5px (or confirm)
  when implementing.

## Links — switch from textarea to a structured list (Task Popup + Subtasks)
- The current app stores Links as a **free-text textarea** ("one URL per line"). This design
  replaces it with a **list of individual link rows** (chain icon · URL field · ✕ remove) plus
  an **+ Add link** button, on BOTH the Task Popup and the Subtask editor.
- Rationale: keeps links tidy/removable and reads as a real list — a reasonable stand-in for
  attachments while file upload isn't available.
- Migrate the existing Task Popup Links textarea to this control so the two stay consistent.

## Subtask IDs — parent.index
- Subtasks are identified as **#<parent>.<index>** (e.g. #142.2). The detail panel's breadcrumb
  header reads: ← Back · {Parent name} #142 › {Sub-task name} #142.2.

## Calendar holiday/event names — Monthly day-detail (mobile), icon-only in cells
- On the **mobile Monthly** grid the cells are too small for holiday/observance and event NAMES,
  so cells show **only the star (holiday) / megaphone (event) icon**. The actual names should
  appear in the **day's task list when the day is tapped** (Monthly only).
- Web Monthly keeps the inline name label (cells are wide enough), matching today's app.
