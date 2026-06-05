# Ananda Taskboard — Design handoff for Claude Design

What still needs designing, from this build session. The existing desktop mock
(`design/Ananda Taskboard - Web.html` + the `*-mockup.html` files) has been
faithfully implemented. Two gaps remain: **(1) responsive/mobile for everything**,
and **(2) several screens added after those mocks that have no design at all.**

See `design/FIDELITY-DEVIATIONS.md` for the full list of app features vs. the mock.

_Date: 2026-06-05._

---

## PART 1 — Responsive / mobile (the big gap)

The mock is a single **desktop** layout (~1200px). There is **no phone or tablet
design**. The current mobile behaviour is developer-improvised CSS (two
breakpoints, 1180px and 760px) that merely reflows desktop — it is functional,
not designed. **Please design phone + tablet layouts for every screen.**

Decisions we need from Design:
- **Breakpoints**: define phone / tablet / desktop ranges (we currently guess at
  760 and 1180).
- **Primary navigation on phone**: the desktop chrome is topbar (logo + 4 icon
  actions + New + user pill) → project pill-tabs → sub-tabs → view segment
  (List/Board/Weekly/Monthly) → filters → summary strip. That's a lot of vertical
  chrome. How should it collapse? (hamburger? bottom tab bar for the 4 views?
  a "filters" sheet? a condensed sticky header?)

Per-screen, the hard responsive questions:
- **List (7-column table: Task · Project · Sub-project · Assignees · Status ·
  Deadline · Recurs)** — a wide table doesn't fit a phone. Card layout? Priority
  columns with the rest in an expandable row? Horizontal scroll with a frozen
  Task column (current improvised behaviour)?
- **Board (Kanban, 4+ colored columns)** — horizontal scroll, or one column at a
  time with swipe/segmented control?
- **Weekly (7-day spanning-bar grid, with the "today" restate overlay)** — keep
  the 7-col grid and scroll, or switch to a single-day / agenda list on phone?
- **Monthly (calendar grid)** — compact month, or an agenda list?
- **Task modal + admin dialogs** — full-screen sheets on phone? The task modal is
  long (name, project/sub, assignees, details/requirements, dates, links,
  recurrence, subtasks, comments).
- **Touch**: tap-target sizes for the inline editors (status pill, assignee
  avatars, tier/role selects), and whether drag-to-move on the Board works on
  touch or needs an alternate affordance.
- **Summary stat strip** and **filters row** on narrow widths.

Dark mode must be designed for every responsive layout too (the app has light +
dark + "follow system").

## PART 2 — Screens with NO design (need web AND mobile)

These were added this session (multi-tenancy + self-serve signup + auth) and are
**not in any mock**:

1. **Login** — email + password, "forgot password" link. (Exists, unstyled-to-spec.)
2. **Signup / org creation** — collects org name + city/country + admin name/email
   /password; then a "check your email to verify" confirmation screen.
3. **Email verification landing** (`?verify` link from the email) — success /
   failure / expired states.
4. **Forgot password + Reset password** (`?reset` link) — request form, reset
   form, success/expired states.
5. **Org switcher** — a user can belong to multiple organizations; needs a switcher
   in the chrome (and a visual indication of the active org). Where does it live
   on desktop vs phone?
6. **First-run / empty org** — a brand-new org has no projects/tasks; needs an
   onboarding / empty-state design ("create your first project").
7. **Platform-owner dashboard** (superuser only) — a metadata-only directory of all
   orgs (names, locations, admin contacts, project/task counts, member roster).
   Never shows org task content. Needs a table/dashboard design.

Also worth a deliberate design pass (currently inherit generic styling):
- **Admin dialogs** — confirm the `admin-screens-mockup.html` covers all of: Team
  (Members / Groups / Access / Activity tabs), Manage Projects, Settings (push
  time, editable statuses, calendar events), Trash, Import (CSV dry-run table),
  Export (scope picker), History (audit), Restore points, Bulk migrate, Approvals
  queue. If not, those need design.
- **Day-detail modal** (tapping a day in Weekly/Monthly).
- **System states** across the app: empty, loading, error, offline (it's a PWA),
  and the toast/snackbar style.

## PART 3 — Decisions for Design (carried over from implementation)

1. **List columns**: to match the mock's exact 7 columns we folded **priority →
   an inline icon in the Task cell** and **start/end time → a line under the
   Deadline**. Keep that, or give priority and/or time their own columns
   (especially relevant for the responsive layout)?
2. **Tiers**: the customization UI was removed; the fixed set is Volunteer / 
   Coordinator / Lead, each shown with a one-line description in the dropdown.
   Confirm naming + whether the description should appear elsewhere (e.g. the
   member row, not just the dropdown).
3. **i18n**: 13 UI languages including long ones (German, Tamil) — every layout,
   especially the tight chrome and table headers, must tolerate ~1.5–2× longer
   strings without clipping. The brand tagline is currently English-only.
4. **Icon set**: implemented with `lucide-react` (the mock's icons are lucide), so
   any new screens should pick from lucide for consistency.
5. **Overdue/soon badges**: shipped as a red circle + white "!" (overdue) and a
   yellow circle + clock (due-soon); confirm this is the intended treatment
   everywhere.
