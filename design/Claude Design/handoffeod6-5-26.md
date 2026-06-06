# Design Handoff — Reduced-Access Features

**Date:** 2026-06-05 (EOD)
**For:** Claude Design — desktop web **and** responsive (mobile) browser versions
**Scope:** Three capabilities that just became available to Members/Viewers (non-admins) — they were admin-only before. The screens work but were built function-first; they need design treatment.

**Current-state screenshots** (the "before"): `qa/shots/ra_01_member_board.png`, `ra_02_member_menu.png`, `ra_03_member_bulk.png`, `ra_04_member_trash.png` (in the reduced-access worktree). Ask if you need them copied alongside this file.

---

## 1. Trash — now member-facing
- **Entry:** "Trash" button in the top bar (♻️ icon + label). Was admin-only; now everyone sees it.
- **Member view:** a single **Tasks** list — *only the tasks they personally deleted*. No Projects/Sub-projects sections (those stay admin-only). Each row: task title · "N days left" (7-day retention countdown) · **Restore** · **Delete forever**.
- **Admin view:** unchanged (Projects + Sub-projects + Tasks, all of the org's trash).
- **States to design:** empty ("you've deleted nothing"), populated, post-restore (row leaves the list), delete-forever confirm.
- **Desktop:** wide modal. **Responsive:** rows + the two action buttons must stack/fit on narrow screens; the countdown shouldn't crowd the title.
- File: `frontend/src/components/Trash.tsx`. Screenshot: `ra_04_member_trash.png`.

## 2. Bulk actions — now member-facing, limited
- **Entry:** "Bulk migrate" in the user menu (↔). Was admin-only; now everyone.
- **Member view:** the action bar shows **only Set Status + Set Deadline**. Move / Reassign / Archive are **hidden** for members (admin-only). Below the bar: a filterable, checkbox task list.
- **New feedback:** the result message can read **"{n} updated · {k} skipped (no edit access)"** — needs a clear, non-alarming treatment (info, not error).
- **States:** nothing selected (bar dimmed), selection active, applied (success), partial-skip feedback.
- **Desktop:** wide modal, horizontal control bar + table. **Responsive (the hardest screen):** the multi-control bar + wide table need a real mobile layout — stacked controls, a sticky "apply" bar, and the table as horizontally-scrolling or a card list.
- File: `frontend/src/components/BulkMigrate.tsx`. Screenshot: `ra_03_member_bulk.png`.

## 3. Personal preferences — user menu
- **New:** a **"Daily reminder"** on/off toggle (📨 + checkbox) in the user-menu dropdown, for everyone (controls whether they personally receive the daily push).
- Theme + Language already live here and now **persist per-user** (follow the user across devices) — no new control, just note it's sticky now.
- **Design decision to flag:** the user menu is getting crowded (Language, Theme, Notifications, Daily reminder, Bulk migrate, + admin items). Decide: keep it as a longer dropdown, **or** split personal prefs into a small "Preferences" panel/sheet (keeping admin "Settings" separate). Recommendation: a Preferences sheet, especially on mobile.
- **Desktop:** dropdown. **Responsive:** consider a bottom-sheet / full-width menu; toggle + select tap targets ≥ 44px.
- File: `frontend/src/App.tsx` (`UserMenu`). Screenshot: `ra_02_member_menu.png`.

## 4. Top bar / nav (both viewports)
- The Trash icon now appears for everyone — confirm it fits the member top bar. The mobile top bar is **icon-only** (text labels hide on narrow screens).
- Reference: `ra_01_member_board.png`.

---

## Cross-cutting (applies to both versions)
- **Reduced-access microcopy:** members should *understand* the limits — why bulk has fewer actions, what "skipped — no edit access" means, why their trash shows only their own deletions. Keep wording light and friendly.
- **Consistency:** match the existing "Temple of Light / Claude Design" reskin already applied. New elements (the daily-reminder toggle, the skipped message, member empty states) should use the same tokens (color, type, spacing, radius).
- **Empty + error states** for all three surfaces.
- **Responsive breakpoints:** the app already hides text labels (`.lbl`) on narrow screens; **modals are the main responsive gap** — Trash and especially Bulk.
- **Multi-tenancy context (not your scope, just FYI):** the app is now multi-tenant — there's an org switcher in the header from separate work. A member's Trash/Bulk/prefs are scoped to their active org. Design within a single org's context.

---

## Quick index of what changed
| Surface | Who sees it now | Component | Screenshot |
|---|---|---|---|
| Trash (own deletions) | all members | `Trash.tsx` | `ra_04_member_trash.png` |
| Bulk (status/deadline only) | all members | `BulkMigrate.tsx` | `ra_03_member_bulk.png` |
| Daily-reminder toggle + prefs | all members | `App.tsx` `UserMenu` | `ra_02_member_menu.png` |
| Trash entry in top bar | all members | `App.tsx` top bar | `ra_01_member_board.png` |
