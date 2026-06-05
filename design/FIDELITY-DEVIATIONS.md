# Ananda Taskboard — App ↔ Claude Design deviations

A running list of where the live app intentionally differs from
`design/Ananda Taskboard - Web.html`, for the Design team to review. Two kinds:
**(A) app features the design mock doesn't depict**, and **(B) intentional
implementation decisions** that diverge from the mock. The goal is still 100%
visual fidelity wherever the design and the app overlap — this documents the
places where the app is a *superset* or where a judgement call was made.

_Last updated: 2026-06-05._

---

## A. App features NOT shown in the design mock
These exist in the production app and need a design treatment (or a decision to
hide them). The mock is a single-tenant, English, post-login snapshot.

1. **Multi-tenancy / org switching.** Users can belong to multiple organizations
   with a per-org role (admin/member) and tier. Needs: org switcher in the chrome,
   and possibly an org name in the brand area. (Mock shows one org.)
2. **Internationalization — 13 UI languages.** Full locale catalogs (en, it, es,
   fr, de, pt, zh, hi, bn, ta, te, mr, gu) + a language picker in the account menu.
   Long languages (German, Tamil) stress every label/column width. Mock is English.
3. **Authentication & password reset.** Login screen, forgot/reset-password flow
   (email link). Mock starts already logged in.
4. **Permissions / tiers / member visibility.** Admin vs member vs viewer per
   sub-project; member-submitted changes; group-based assignee filtering; people
   are only visible within the scopes a user can access. Mock is flat/all-access.
5. **Approvals queue.** Admins review member-submitted task changes (the
   "Approvals" button opens a real queue). Mock shows the button only.
6. **Trash + 7-day restore**, nested by project/sub-project. Mock shows the button.
7. **Restore points, audit History, Bulk-migrate** (move tasks between projects) —
   admin tools in the account menu. Not in the mock.
8. **Import (CSV dry-run table) / Export (scope picker dialog).** Mock shows buttons.
9. **Admin-editable statuses.** Statuses (the Kanban columns / pills) are
   rename/recolor/reorder/add/remove-able in Settings. Mock hard-codes
   To Do / In Progress / Delayed / Done.
10. **Priority (5 levels: Highest…Lowest).** With a filter and an icon. The mock's
    List has no priority column (only overdue/soon flags).
11. **Timed tasks (start/end time).** The mock's List has no Time column.
12. **Recurrence engine.** Full rules (daily/weekly/monthly/yearly, interval,
    weekdays, end-date/count) edited in the task modal. Mock shows only a
    "Recurs: monthly/weekly" label.
13. **Calendar events (multi-day spans).** Separate from tasks, shown on
    Weekly/Monthly. The mock shows a single event string per day in the header.
14. **Subtask assignees.** Subtasks can have their own owner + status (not just a
    progress bar). Mock shows the progress bar only.
15. **Monitor / Auto-complete task flags.** "Notify admins when moved",
    "auto-mark Done after deadline". Not in the mock.
16. **Web-push notifications** (daily digest opt-in). Not in the mock.
17. **Archive view** (toggle to show archived tasks). Not in the mock.
18. **Share view / deep-linking.** URL reflects project/sub/view/task; "Share view"
    copies a deep link. Mock shows the button.
19. **PWA** (installable, offline service worker). N/A to a static mock.
20. **"System" theme option** (follow-OS) in addition to the mock's light/dark
    toggle.
21. **Global Overview / Project Overview toggles** are configurable per org/project
    (the mock always shows them).

## B. Intentional implementation decisions that differ from the mock
Where the app and mock overlap, these are deliberate choices — flag any you want
changed.

1. **Icons: `lucide-react`** instead of the mock's inline SVGs. The mock's icons
   *are* lucide (viewBox 0 0 24, stroke 1.7), so these are visually equivalent and
   maintained; not a hand-copy of each path.
2. **List columns — priority & time relocated.** To keep the mock's exact 7-column
   List (Task · Project · Sub-project · Assignees · Status · Deadline · Recurs)
   without dropping app data: **priority → an inline icon in the Task cell**, and
   **start/end time → a small line under the Deadline**. Easy to split back out if
   Design prefers dedicated columns.
3. **Summary-strip labels** ("Tasks / Overdue / Due soon") are English placeholders
   pending translation keys across all 13 locales.
4. **Avatar colors are generated** deterministically from the user id (stable
   per-person) rather than the mock's hand-assigned per-person palette. Same look,
   different exact hues.
5. **Weekly events** render as a per-day line in the day header (mock behavior) but
   are derived from the app's multi-day event spans, so a span shows on each day it
   covers rather than a single hard-coded string.
6. **Brand tagline** ("Love & Blessings from Ananda Los Angeles") matches the mock
   text but is currently a hard-coded English string (not i18n'd).
7. **Status keys vs labels.** Stored status keys stay stable (e.g. `in_progress`);
   the visible label is whatever admins set — so a status could read "Doing" if an
   admin renames it, unlike the mock's fixed "In Progress".
8. **Project tabs show a colored dot, not a per-project emoji** — the app's project
   model has a color but no emoji field (the mock's project glyphs are decorative).

## C. Known fidelity gaps still being closed (not yet matching, in progress)
1. **Task modal** and **admin dialogs** (Team/Projects/Settings/Trash/Import/Export
   /Approvals/History/Restore/BulkMigrate) use a baseline modal style, not yet the
   mock's full `.sheet` treatment.
2. **Monthly** view — finishing a line-by-line match to the mock's `renderMonthly`.
3. **Board** minor: segbar shows `done/total` (mock appends the word "Done"); card
   dates aren't zero-padded.
