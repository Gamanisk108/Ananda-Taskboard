# Design Handoff — Help, FAQ & Onboarding, Subtask Editor (+ status relabel)

**For:** Claude Design — desktop web **and** responsive (mobile) browser versions.
**Purpose:** A **standalone** handoff for the in-app Help/FAQ/onboarding feature built
2026-06-06, kept separate from the rolling `design-change-handoff.md` so that log stays
focused on its earlier scope. Same convention: each change says what it is, the state to
**draw**, desktop + responsive notes, and the file. Several items are **new components/states
to design**.

**Status:** built and **live-Playwright-QA'd in light + dark** (admin login). Screenshots were
working artifacts and not retained — states are described below. Spec of record:
`docs/superpowers/specs/2026-06-06-help-onboarding-design.md`.

---

## Entry — 2026-06-06 — Help center, onboarding, What's New

### 1. Help "?" button in the top bar — NEW nav affordance
- **What:** a new **`?` (CircleHelp) button** in the header action row (`topbar-actions`),
  visible to **everyone** (not admin-gated), sitting just before the separator + **+ New task**.
- **What's-New dot:** when unseen new features exist, a small **accent dot** (purple
  `#6d4aff`) sits at the button's top-right corner.
- **Draw:** the `?` ghost button (icon + "Help" label, label hidden at narrow widths like the
  other top-bar buttons), and the dot variant. Light + dark.
- File: `frontend/src/App.tsx`.

### 2. Welcome card — NEW onboarding component (skippable, once-ever)
- **Trigger:** first login only (until dismissed; `localStorage["at-onboarded"]`).
- **Appearance:** a centered `Modal` titled **"Welcome to Ananda Taskboard 🙏"**, a short
  intro line, then **3 plain bullets with emoji** — 🗂️ open a project tab · 🔀 switch
  List/Board/Weekly/Monthly · ➕ the big **+ New task** button — a muted helper line
  ("reopen anytime from the ? Help button"), and two buttons: **Skip** (ghost) and **Got it**
  (primary). Both dismiss; shows once ever.
- **Draw:** the welcome card with its 3 emoji bullets and Skip / Got it footer. Light + dark,
  centered, standard (~520px) modal width.
- File: `frontend/src/components/WelcomeCard.tsx`.

### 3. Help center panel — NEW component (the main one to design)
- **What:** the `?` opens a **wide `Modal` titled "Help & FAQ"** containing a search box plus
  the help content organised into **collapsible, counted sub-sections**.
- **Landing (no search):** a **search input** (autofocus), then the sections **collapsed by
  default** — each a row with a **right/down chevron**, a **bold label**, and a **count pill**
  on the right. Section order + counts:
  **Getting around (4) · Everyday tasks (4) · Your account (3) · For admins (9) · Common
  questions (5).** This compact, scannable landing is the deliberate fix for an earlier
  "wall of text" version.
- **Expanded section:** the header gets a subtle hover/active background; its articles list
  beneath, each an **article row** (bold title + chevron) that **expands its body** (1–2 short
  paragraphs) on click. Rows have a hover background.
- **What's New block:** when unseen dated features exist, a **"✨ What's new"** section renders
  **above** the collapsible sections, listing those articles with a purple **"New"** pill.
- **Search:** typing filters across **all** sections into a **flat result list** (sections
  hidden); empty query restores sections. No matches → a muted **"No help found…"** empty state.
- **Footer:** a left **"🙏 Show welcome again"** ghost button and a right **"✉ Contact us"**
  link (`mailto:Hanuman@anandala.org`).
- **Draw (states to spec):** (a) collapsed landing with 5 counted section rows; (b) one section
  expanded with article rows; (c) an article expanded showing body text; (d) What's New block
  with New pills; (e) flat search results; (f) no-results empty state; (g) footer with both
  actions. **Light + dark.**
- File: `frontend/src/components/HelpCenter.tsx`, styles in `frontend/src/App.css` (`.help-*`).

### 4. "Admin" chip on admin-only help — NEW chip variant
- **What:** help articles for admin tools (Projects, Team, Approvals, Trash, Settings, History,
  Restore points, Bulk migrate, Holidays) no longer say "(admins)" in their titles. They sit
  under the **"For admins"** section **and** carry a small **muted grey "ADMIN" pill** (with an
  "Admin only" tooltip) on the title row — so they still read as admin-only in **flat search
  results** and **What's New**, where there's no section header.
- **Draw:** the grey uppercase "Admin" chip (muted, distinct from the purple "New" chip), shown
  on an article row; and an article carrying **both** chips at once (e.g. the holidays article
  in What's New). Light + dark.
- File: `frontend/src/components/HelpCenter.tsx`, `App.css` (`.help-chip`, `.help-chip-admin`,
  `.help-chip-new`).

### 5. Status relabel — "Ready for Review" → **"Review"**
- **What:** the 5th status (purple `#7A5AA6`, between Delayed and Done) is **renamed to
  "Review"** everywhere — Kanban column header, status pill, List-view summary strip, and
  status filter. Color, order, and behavior unchanged.
- **Draw:** update any design reference that shows the status name to read **"Review"** (the
  rolling log's earlier "Ready for Review" entry now describes the old name). Column order:
  To Do · In Progress · Delayed · **Review** · Done.
- File: `backend/tasks/models.py`, `backend/tasks/migrations/0024…`, `0025_rename_review_label.py`,
  `frontend/src/statuses.ts`.

### 6. Holiday text — Janmashtami label (minor, text only)
- **What:** the holiday chip for Janmashtami now reads **"Janmashtami (Babaji Commemoration
  Day)"** (Ananda/SRF lineage observance). No visual change — same muted holiday chip as the
  rolling log's holidays entry; only the longer text (mind wrapping in narrow day cells).
- File: `backend/tasks/holidays_feed.py`.

### Translation flag (not visual)
New UI strings were added to **all 13 locales** as **English placeholders** (parity test
stays green; real translations later): `help.*` (`title`, `open`, `search`, `whatsNew`,
`newBadge`, `noResults`, `replayWelcome`, `adminChip`, `adminOnly`, `contact`, and
`help.cat.{views,tasks,account,admin,faq}`) and `onboarding.*` (`title`, `intro`, `b1`–`b3`,
`help`, `gotIt`, `skip`). Help **article/FAQ body text** is English-only for now and falls
back to English per-key until `content/<locale>.ts` files are added (no design impact).

### NOT design-relevant (internal — ignore for design)
The help **registry/tripwire** (`src/help/registry.ts`, `help.test.ts` — a test that fails CI
when a new feature button has no help article), the two-tier content loader
(`src/help/content/*`), the What's-New `localStorage` baseline logic, and the status-rename
data migration. These keep help in sync and drive behavior but need no design treatment.

---

## Entry — 2026-06-06 — Rich subtask editor (slide-in detail panel)

**Context (read first):** This is a **distinct feature from Help/Onboarding above** — it's
bundled into this handoff per request. Subtasks used to be a flat checklist (one row =
title + an inline assignee dropdown + a status dropdown). They now become **"mini-tasks":**
each subtask gets its own **simplified Task Popup**, opened as a **slide-in detail panel that
replaces the Task modal's body in place** (breadcrumb + Back — **never a second, stacked
modal**). Nesting is **capped at one level** (subtasks have no subtasks), so the breadcrumb is
only ever two deep — a deliberate guard against an "overwhelming page-after-page drill-down."
**Built and live-Playwright-QA'd in light + dark** (admin login); screenshots were working
artifacts and not retained — states are described below. The simplified popup is the **full
Task Popup minus** project/sub-project picker, Links, Repeats/recurrence, Monitor,
Auto-complete, approval banners, comments, and any nested subtasks.

### 1. Subtask list rows — CHANGED look (compact, click-to-open)
- **What:** inside the Task modal, below the task form, the **"Subtasks (N)"** section. Each row
  is now a **clickable open-target** on the left (subtask **title** + the assignees' **avatar
  chips**, plus a small **◇ group indicator** when whole groups are assigned), then a **quick
  status dropdown** (one-click status change without opening the detail), then a **✕ delete**
  ghost button. The **quick-add row** ("Add a subtask…" input + **Add** button) stays at the
  bottom for fast title-only capture. (Previously the row carried an inline *assignee* select +
  status select; assignment now shows as avatars and is edited in the detail panel.)
- **Draw:** the section heading with count; 2–3 rows showing title + avatar-initials chips
  (e.g. "LL") + status select + ✕; the **◇ group-assigned** variant; the quick-add row. The row
  should read as clickable (hover background / pointer). Light + dark.
- **Responsive:** rows wrap gracefully; the status select stays tappable at narrow widths;
  avatars cap at **3** then truncate. Title ellipsizes before pushing the controls off-row.
- File: `frontend/src/components/SubtaskEditor.tsx`.

### 2. Slide-in subtask detail panel — NEW component (the main one to design)
- **What:** clicking a subtask row **swaps the Task modal's body in place** — the task form, its
  footer, and the comments section are hidden, and the subtask editor takes their place. The
  **modal title stays "Edit task · #ID"** (it does **not** become a new window). A **breadcrumb**
  row sits at the top: **← Subtasks** (ghost button) · **›** · **{subtask title}** (bold).
- **Fields (the "simplified Task Popup"), top to bottom:**
  - **Task name** — full-width input.
  - Row of two: **Status** (select) | **Priority** (priority arrow-icon + select).
  - **Assignees** — the **existing AssigneePicker** reused as-is: collapsed chip summary + an
    **Edit** link that expands to a search box, group-filter, "assign a whole group" buttons, and
    a checkbox people-list. It is **scoped to the parent task's sub-project**, so people without
    access there get the muted **"no access"** tag (same as on the full Task Popup).
  - Row of two: **Details** | **Requirements** — textareas.
  - Row of two: **Start date** | **Deadline** — date inputs.
  - Row of two: **Start time** | **End time** — time inputs.
  - **Footer:** **← Back to subtasks** (ghost, pinned left) · **Delete** (danger) · **Save**
    (primary).
- **Draw (states to spec):** (a) the full detail panel with breadcrumb + all field rows +
  footer; (b) with an assignee chip in the collapsed AssigneePicker (e.g. "LL Lead Lena");
  (c) AssigneePicker **expanded** (search + group buttons + checklist, incl. a "no access" row);
  (d) **time validation error** — a red message under the time row reading **"Set both a start
  and end time, or neither."** (Save blocked, panel stays put); (e) Priority showing the **High**
  up-arrow icon. **Light + dark.** Same wide width as the Task Popup.
- **Responsive:** the two-up field rows **stack to a single column** on mobile; footer buttons
  wrap (keep **Back** reachable); the breadcrumb **truncates a long subtask title with an
  ellipsis** rather than wrapping.
- File: `frontend/src/components/SubtaskDetail.tsx`; the in-place body swap lives in
  `frontend/src/components/TaskModal.tsx`.

### 3. Task ↔ subtask transition — motion (optional, design's call)
- **What today:** the swap is an **instant in-place replace** (no animation). Parent task edits
  are **preserved** across the swap (typing in the task form, opening a subtask, and hitting Back
  returns you to your unsaved edits).
- **Draw / spec (optional):** a subtle **horizontal slide / crossfade** for the task→subtask and
  Back transitions would reinforce the "one surface, going one level in" mental model. Because
  edits survive, the motion should imply **"pushed aside,"** not "closed and reopened." Specify
  direction (subtask slides in from the right, Back slides it out), duration, and easing.

### Subtask status dot on the parent (already exists — no change, just FYI)
Saving a subtask refreshes the parent task card's existing **"subtasks by status" dot strip**
(e.g. "In Progress: 1"). No new design — noting it so the parent-card spec isn't touched.

### Translation flag (not visual)
**3 new keys**, added to **all 13 locales** with **real translations** (not placeholders):
`subtask.back` ("Back to subtasks"), `subtask.confirmDelete` ("Delete this subtask?"),
`subtask.editDetails` ("Edit details" — the row's open tooltip). Every other label **reuses
existing keys** — `task.{name,status,priority,assignees,details,requirements,startDate,deadline,
startTime,endTime}` and `common.{save,delete}` — so no new strings to design around.

### NOT design-relevant (internal — ignore for design)
The backend change (single `assignee` → **multiple `assignees` + `assignee_groups`** M2M with a
data-preserving migration), the serializer's both-or-neither **time validation**, the **extended
edit permission** (any assignee — or a member of an assigned group — may edit a subtask even
without parent-edit rights), and the unit tests. These drive behavior but need no visual
treatment.
