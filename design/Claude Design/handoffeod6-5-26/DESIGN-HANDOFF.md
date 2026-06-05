# Design handoff — Core app: responsive/mobile + open decisions

**Companion to `multi-tenancy-ui-handoff.md`** (in this folder), which covers the
auth / signup / onboarding / org-switcher / platform-overview / invite screens for
both desktop and mobile. That doc explicitly leaves the *core task views* out of
scope — **this doc covers exactly that gap**: responsive/mobile for the core
List / Board / Weekly / Monthly + chrome + task modal + admin dialogs, plus the
implementation decisions still open. Full feature-vs-mock list:
`FIDELITY-DEVIATIONS.md` (same folder).

The existing desktop mock (`../Ananda Taskboard - Web.html` + the `*-mockup.html`
files) has been faithfully implemented. The core gap is **responsive/mobile** — the
mock is a single desktop layout (~1200px); there is **no phone or tablet design**
for the task views. Current mobile behaviour is improvised reflow CSS (breakpoints
at 760/1180), functional but not designed.

_Date: 2026-06-05._

---

## What needs responsive (phone + tablet) design

Design system to match: warm cream `#FBF6EA`, navy `#1E3A6E`, lucide icons, light +
dark, 13 languages (allow ~1.5–2× longer strings — German/Tamil). Inputs ≥16px to
avoid iOS zoom; tap targets ≥44px.

**First, two cross-cutting decisions:**
- **Breakpoints** — define phone / tablet / desktop ranges.
- **Primary navigation on phone.** Desktop stacks a lot of vertical chrome:
  topbar (logo + 4 icon actions + New + user pill) → project **pill-tabs** →
  **sub-tabs** → **view segment** (List/Board/Weekly/Monthly) → **filters** →
  **summary stat strip**. How should this collapse? (hamburger, a bottom tab bar
  for the 4 views, a filters sheet, condensed sticky header?) Keep **+ New task**
  and the **org switcher** reachable; never hide the active org.

**Per screen:**
1. **List** — desktop is a 7-column table (Task · Project · Sub-project · Assignees
   · Status · Deadline · Recurs) with a frozen Task column. On phone a wide table
   doesn't fit — design the layout: stacked cards? expandable rows? horizontal
   scroll with a frozen Task col? Also where the **inline editors** (status pill
   w/ caret, assignee avatar stack, recurrence) go on touch.
2. **Board (Kanban)** — 4+ colored columns with cards (priority, project, date,
   avatar stack, subtask progress bar, overdue/soon ring). Phone: horizontal
   scroll, or one column at a time (swipe / segmented)? Touch alternative to
   drag-to-move between columns.
3. **Weekly** — a 7-day spanning-bar grid; multi-day bars **restate the task name
   on the “today” column**; overdue/soon bars carry a ring + warning/clock badge.
   Phone: keep the 7-col grid (scroll), or switch to single-day / agenda list?
4. **Monthly** — full calendar grid with per-day count badges + today/overdue/soon
   states. Phone: compact month, or an agenda list?
5. **Summary stat strip** + **filters row** — how they condense on narrow widths
   (the strip is `28 tasks · 4 overdue · 2 due-soon · per-status counts`).
6. **Task modal** — long form (name, project/sub, assignees, details, requirements,
   start/deadline dates, links, recurrence panel, subtasks w/ progress, comments).
   Full-screen sheet on phone? Section order / collapsing?
7. **Admin dialogs** (Team’s Members/Groups/Access/Activity, Manage Projects,
   Settings, Trash, Import dry-run table, Export, History, Restore, Bulk-migrate,
   Approvals) — wide, table-heavy dialogs; on phone the tables should reflow to
   stacked label/value cards and the dialogs become full-screen sheets.
8. **Day-detail modal** (tapping a day in Weekly/Monthly) and **system states**:
   empty, loading, error, **offline (it’s a PWA)**, and the toast/snackbar style.

---

## Open decisions for Design (from implementation)

1. **List columns** — to hit the mock’s exact 7 columns we folded **priority → an
   inline icon in the Task cell** and **start/end time → a line under the
   Deadline**. Keep that, or give priority and/or time their own columns? (Big
   impact on the responsive layout.)
2. **Tiers** — the customization UI was removed; the fixed set is
   **Volunteer / Coordinator / Lead**, each shown with a one-line description in the
   dropdown (“View assigned tasks only” / “…in assigned Sub-Project” / “…in
   assigned Project”). Confirm naming + where the description should appear.
3. **Overdue/soon badges** — shipped as a **red circle + white “!”** (overdue) and a
   **yellow circle + clock** (due-soon), used on every view. Confirm.
4. **Icon set** — implemented with **lucide** (the mock’s icons are lucide); new
   screens should pick from lucide for consistency.
5. **Dark mode** — must be designed for every responsive layout, not just desktop.
