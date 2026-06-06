# Design Change Handoff — Rolling Log

**For:** Claude Design — desktop web **and** responsive (mobile) browser versions.
**Purpose:** Running list of shipped UI/UX changes the design reference (`Ananda Taskboard - Web.html` / standalone) should be updated to match. Function-first changes that need design treatment.

**How to use this file:** append a new dated `## Entry — YYYY-MM-DD` block at the BOTTOM for each session of changes. Newest at the bottom. Don't rewrite earlier entries. Each change: what changed, the new state to draw, desktop + responsive notes, file, and screenshot if any.

---

## Entry — 2026-06-05 — Bug-fix + UX pass

Source: QA run `qa/runs/2026-06-05/report.md`. Before/after screenshots: `qa/runs/2026-06-05/shots/fix-01-dark-weekly-today.png`, `fix-02-dark-monthly-today.png`, `fix-03-viewer-readonly-task.png`.

### 1. Dark-mode "Today" highlight — Weekly + Monthly
- **Was:** today's column (Weekly) / cell (Monthly) rendered a solid **white block** in dark mode — a bug; the "TODAY" badge was light-on-light, nearly illegible.
- **Now:** the today column/cell **body stays dark** — a faint azure wash (`color-mix(azure 12–14% / surface)`) — highlighted only by a **light azure border frame**. Badge legible on dark.
- **Design ref:** dark-mode today = subtle wash + border frame, **not** a filled block. Light mode unchanged.
- File: `frontend/src/index.css` (`--wk-today` / `--mo-today` in the dark block). Shots: `fix-01`, `fix-02`.

### 2. Modal interaction + layout — ALL modals
- **New behaviors:** Escape closes; backdrop-click closes; modal **header is fixed** (stays on screen); the **body scrolls** internally; modal height bounded to ≈ `viewport − 64px` (mobile `− 20px`). The ✕ close stays reachable even on very tall modals (e.g. Manage Projects with many projects).
- **Was:** tall modals grew past the viewport, pushing the header + ✕ off-screen → user felt trapped; Escape/backdrop did nothing.
- **Design ref:** spec every modal as fixed-header / scrollable-body / bounded-height. Note the close affordance is always visible.
- File: `frontend/src/components/common.tsx` (`Modal`), `frontend/src/App.css` (`.modal`, `.modal-head`, `.modal-body`).

### 3. Read-only task modal — NEW STATE to design
- **Trigger:** a viewer (view-only access) opens a task they can't edit.
- **Appearance:** "👁 View only" badge at top; **all fields disabled/greyed**; Project + Sub-project shown as **static text** (the task's real scope), not dropdowns; status as a static pill; footer collapses to a **single Close button** (no Save / no Delete). Comments stay enabled (viewers may comment).
- **Why:** before, viewers got a fully-editable form that only failed with an error on Save, and the Project dropdown mis-showed a postable project instead of the task's real one.
- **Design ref:** add this read-only task-modal variant to the design set.
- File: `frontend/src/components/TaskModal.tsx`. Shot: `fix-03`.

### 4. Project nav rail — bounded
- **Now:** the project pill rail (`.tabs`) caps at ~3 rows (`max-height ~124px`) then **scrolls** internally.
- **Was:** unbounded wrap — with many projects it ate large vertical space.
- **Design ref:** show the rail capped + internally scrolling at high project counts.
- File: `frontend/src/App.css` (`.tabs`).

### 5. Disabled-control states (minor)
- Team table: a user's **own Role select is disabled** (with tooltip "You can't change your own admin role") instead of failing on use.
- Submit buttons (comment, add member, invite, add group) now show a **disabled state while the request is in flight** (prevents double-submit).
- **Design ref:** ensure disabled states for these controls are styled.
- Files: `frontend/src/components/TeamAdmin.tsx`, `CommentSection.tsx`, `TaskModal.tsx`.

### Translation flag (not visual)
New UI strings added to `en.json` only: `task.viewOnly`, `task.viewOnlyHint`, `ta.ownRoleLocked`. The other 12 locales fall back to English until translated.

### NOT design-relevant (internal — ignore for design)
Orphaned-assignment permission fix, double-submit guard logic, `<html lang>` sync, JWT single-flight refresh, TanStack Query data-layer migration, QA folder restructure.

---

<!-- Append the next session's entry below this line. -->
