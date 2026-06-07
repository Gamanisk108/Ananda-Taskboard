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

## Entry — 2026-06-06 — View Access, multi-select filters, new status, onboarding

Source: feature session (deadline-only calendar, created-on, new status, Tiers→View Access, checkbox filters, new-member onboarding). No QA screenshots yet (live Playwright QA pending — browser was in use by a concurrent task). Several items are **new states/components to design**.

### 1. New status "Ready for Review" — NEW Kanban column + pill
- **What:** a 5th task status added **between Delayed and Done**: **"Ready for Review"**, color **purple `#7A5AA6`** (muted violet from the project palette).
- **Draw:** a new Kanban column, a new status **pill** (purple), and its dot in the List-view summary strip + status filter. Column order left→right: To Do · In Progress · Delayed · **Ready for Review** · Done.
- **Desktop + responsive:** same as existing status columns/pills — just one more column (mind horizontal scroll on mobile Kanban with 5 columns).
- File: `backend/tasks/migrations/0022_seed_review_status.py`, `frontend/src/statuses.ts`.

### 2. Multi-select checkbox filters — NEW COMPONENT to design
- **What:** the List-view filter bar dropdowns became **checkbox multi-selects** for **Project, Sub-project, Assignee (+Groups), Priority, Status**. **Deadline** and **Recurrence** stay as the existing single-select dropdowns (binary/small sets).
- **Closed button:** neutral placeholder when nothing picked (e.g. "Any status"); the single label when one picked; **first pick + "+N"** when several (e.g. "To Do +2"). Active filter = highlighted border (`.ms.on`).
- **Open popover:** a checkbox list under the button; supports **section headers** (the Assignee filter groups options under **People** / **Groups**, with an "Unassigned" option on top). Closes on outside-click / Escape.
- **Draw:** the closed chip in all three states (none / one / first-+N), the open checkbox popover, the active-border state, and the sectioned Assignee variant. Light + dark.
- **Responsive:** chips wrap within the filter bar (already `flex-wrap`); popover should stay within viewport on mobile (max-height + scroll). Consider full-width chips on narrow screens.
- File: `frontend/src/components/common.tsx` (`MultiSelect`), `frontend/src/App.css` (`.ms*`), `frontend/src/components/ListView.tsx`.

### 3. "Created on" timestamps — NEW micro-text
- **Task popup:** a small muted **"Created <Mon D, YYYY>"** line, right-aligned, just under the modal header that shows `· #<id>`.
- **Manage Projects:** a muted "Created <date>" by **each project** (right side of the project row) and **each sub-project** (end of the sub-project row).
- **Draw:** placement + muted styling of these created-on labels. Minor; light + dark.
- Files: `frontend/src/components/TaskModal.tsx`, `frontend/src/components/ManageProjects.tsx`.

### 4. Tiers → "View Access" (rename + new level) — relabel + Access-tab simplification
- **Relabel:** everywhere the Team area said **"Tier"** it now says **"View Access"** (Members table column, add-member field, invite field, member dropdowns).
- **Levels (new set, ordered narrowest→widest in every dropdown):** **Tasks Only · Sub-Project Only · Full Project · Organization** (Organization is new = sees all org tasks). Each option shows a short description after the name. **No "None"/blank option** — every member has one (admins are exempt and show "—").
- **Access tab simplified:** the per-grant **"Sees" selector and the Sees column were removed** (breadth now lives in the member's single View Access, not per grant); the grant builder shows a one-line note pointing to View Access. The grant **subject** dropdown no longer offers "Tier" — only **Person / Group**.
- **Draw:** the relabeled View Access dropdown (4 levels + descriptions), and the slimmed Access tab (grant = scope + level only; no Sees control/column).
- File: `frontend/src/components/TeamAdmin.tsx`, `frontend/src/types.ts`.

### 5. Invite-time project access — NEW field in the invite form
- **What:** the **Invite** form gained a second row: **View Access** (dropdown) + **"Add to projects (optional)"** — a **multi-select of sub-projects** to grant the new member on accept (so they don't land empty). For an **admin** invite this slot shows "Admins see everything" instead.
- **Draw:** the invite form's new two-up row (View Access | Add-to-projects multi-select), and the admin variant.
- File: `frontend/src/components/TeamAdmin.tsx`.

### 6. New-member empty state — NEW STATE to design
- **Trigger:** a **member** logs in who hasn't been added to any project and has no assigned tasks (previously: blank app + bare "No projects yet").
- **Appearance:** a centered friendly card in the content area — **🌱** glyph, heading **"You're all set up!"**, body "An admin hasn't added you to any projects yet. As soon as they add you — or assign you a task — your work will appear right here." (Admins with no projects keep the existing create-first-project flow.)
- **Draw:** this welcome/waiting empty state (member-only). Light + dark, centered, ~460px max width.
- File: `frontend/src/App.tsx`.

### 7. Calendar: deadline-only tasks render as a single-day marker
- **What:** a task with a **deadline but no start date** now appears on the Weekly/Monthly calendar as **one bar on the due date only** — it no longer spans every day from its creation date to the deadline. (Tasks **with** a start date still span start→deadline.)
- **Draw/spec:** deadline-only tasks = single-day markers on the due date; only start-dated tasks draw multi-day spans. No new visual, but the design reference's calendar examples should reflect this rule.
- File: `backend/tasks/calendar.py`.

### Translation flag (not visual)
New UI strings use **inline English fallbacks** (not added to `en.json`), so all 13 locales show English until translated: `ta.viewAccess`, `ta.viewAccessHint`, `ta.viewAccessNote`, `ta.startingAccess`, `ta.adminSeesAll`, `ta.pickSubprojects`, `ta.pickViewAccess`, `task.createdOn`, `mp.created`, `onboarding.welcomeTitle`, `onboarding.welcomeBody`.

### NOT design-relevant (internal — ignore for design)
Permission-engine refactor (View Access drives breadth, new `org` sees level + Organization read-widening), calendar span logic, status/View-Access/invite-access DB migrations, server-side multi-value assignee/group filter params, invitation `access` field + grant-on-accept, `visible_tree` surfacing a tab for any sub-project with a visible task.

---

## Entry — 2026-06-06 — Automatic holidays on the calendar

Source: feature session (auto holidays on Weekly/Monthly calendars, admin holiday settings). Backend + frontend complete and unit/integration-tested; **live visual Playwright QA still pending** (dev ports were occupied by a concurrent worktree) — so the states below are described, not screenshotted. Authoritative date list: `design/Ananda Holidays.jpeg` (ananda.org/thank-you-god). Several items are **new states/components to design**.

### 1. Holidays on Weekly + Monthly calendars — NEW chip variant to design
- **What:** the calendars now auto-display holidays (US Federal, US observances, Christian, Hindu/yoga festivals, Ananda lineage days — e.g. Diwali, Maha Shivaratri, Yogananda's Birthday, Founding of Ananda Village).
- **Appearance:** a holiday is a **muted, icon-less text chip** (name only) — same structural slot as the existing user-event "day notice" (`.mev` in Monthly, `.ev` in Weekly) but **quieter** (muted color, lighter weight) so it reads as **background context**, not an actionable task/event. **No emoji/icon** (user-events keep their 📍🎂📌🔁 icons; holidays deliberately have none).
- **Ordering in a day:** user **events first** (actionable), **holidays after** (context).
- **Draw:** the holiday chip in Monthly day-cell and Weekly day-header, visually distinct from task bars and from user-event chips. **Light + dark** — the muted tone must stay legible in dark mode.
- File: `frontend/src/components/MonthlyView.tsx`, `WeeklyView.tsx`, `frontend/src/App.css` (`.mev.holiday`, `.wk-hcell .ev.holiday`, `.cal-event.holiday`).

### 2. "+N more" day overflow — NEW affordance to design (Weekly fix included)
- **What:** when a single day holds more items than fit (tasks-events + holidays), the cell now stacks the first few then shows a muted **"+N more"** label; clicking the day opens the existing **day modal**, which lists **everything** (tasks + user events + holidays) in full.
- **Caps:** Monthly stacks up to **3** lines then "+N more"; Weekly header stacks up to **2** then "+N more".
- **Weekly bug fixed (design ref change):** the Weekly day-header previously showed **only the first event** and silently hid the rest. It now stacks multiple + "+N more" like Monthly. Update the design reference's Weekly examples to show stacked items, not a single line.
- **Draw:** the `.more` label (small, muted) under the stacked chips in both Monthly cell and Weekly header; and the day modal's holiday lines (muted `.cal-event.holiday`, listed above the task list). Light + dark.
- File: `frontend/src/components/DayCellLines.tsx` (shared), `MonthlyView.tsx`, `WeeklyView.tsx`, `App.css` (`.more`).

### 3. Admin "Holidays" tab — NEW tab + settings panel to design
- **What:** the **Team** modal's segmented control gained a **5th tab: "Holidays"** (admins only). Tab order: Members · Groups · Access · Activity · **Holidays**.
- **Panel:** a short title + helper line, then a **checkbox per holiday set** — *US Federal holidays · US observances (Mother's/Father's Day, Daylight Saving) · Christian / religious · Hindu / yoga festivals · Ananda lineage days* — and a **Save** button with a "Saved" confirmation. Members worldwide only see the sets enabled here (built so other countries can be added later).
- **Draw:** the new tab in the segmented control, and the checkbox-list settings panel (with Save / Saved states). Light + dark.
- **Responsive:** the Team modal segmented control now has **5 tabs** — check wrap/scroll on narrow screens (was 4). The checkbox list is simple and should stack fine.
- File: `frontend/src/components/TeamAdmin.tsx`.

### Translation flag (handled — translated, not English-fallback)
Unlike prior entries, the new holiday UI strings (`tabs.holidays`, `cal.more`, and the `holidays.*` group) **were added and translated across all 13 locales**, so no English-fallback gap here.

### NOT design-relevant (internal — ignore for design)
Backend holiday-feed module (5 providers: library/Easter-math/weekday-rules/curated-lunar-table/fixed-dates), `/api/holidays/range` + `/api/holidays/settings` endpoints, `Organization.enabled_holiday_sets` field, per-(set,year) caching, country-pack extensibility (`country:XX`), `dayCells` merge/overflow helper.
