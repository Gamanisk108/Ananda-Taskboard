---
project: ananda-taskboard
status: in-progress
phase: execute
current-step: 6
last-updated: 2026-06-02
last-commit: "Step 5 (committing now). 65 tests pass."
---

# BUILD-STATE — read this FIRST if resuming

**If you are a fresh session picking this up:** the brainstorm and approval are
DONE. Do not re-brainstorm. Read, in order:
1. `taskboard-goal-brief.md` (the spec) — root of this folder.
2. `.discovery/build-plan.md` (approved design + 12-step build order + data model).
3. This file — find the first unchecked step below and continue from there.
4. `docs/decision-log.md` (if it exists) — choices already made during the build.

**Resume rule:** trust completed (`[x]`) steps; verify the last in-progress
(`[~]`) step's files actually exist before continuing (a token-out may have
interrupted mid-write). Then proceed down the list. Update this file after each
step: flip `[ ]`→`[~]` when starting, `[~]`→`[x]` when done + verified, and bump
`current-step`/`last-updated` in the frontmatter.

**Stack:** Django + DRF backend, React 18 + Vite 5 PWA frontend, SQLite
(DB-agnostic), Web Push (VAPID), Render + GitHub Actions cron. New project; reuse
the stack pattern from `C:\AI\backend` + `C:\AI\frontend`, do NOT copy their data.

---

## Build steps (source of truth for progress)

- [x] **1. Scaffold** — backend (Django+DRF) + frontend (Vite PWA) skeletons,
      docs/ skeleton, `.github/workflows/daily-push.yml`, root README, .gitignore.
      DONE + verified (health ok, frontend builds, migrates). Commit e8d70c6.
- [x] **2. Accounts & auth** — User, Group, JWT login/refresh, `/api/me`.
      DONE + 12 tests pass. Commit 5d870ae. NOTE: `/api/me` tree is a stable
      placeholder; permissions.tree fills it in step 4.
- [x] **3. Projects & sub-projects** — models, admin CRUD, default-subproject
      auto-create, members_post_without_approval toggle field.
      DONE + 11 tests (23 total). NOTE: viewset get_queryset already calls
      permissions.engine.visible_*_ids (wrapped in try/except) — step 4 just
      needs to CREATE that module and those functions.
- [x] **4. Permission engine (TDD FIRST)** — AccessGrant, `visible_subprojects()`
      union + most-permissive, whole-project grants, `/api/me` tree + tab flags.
      DONE + 18 engine tests (41 total). engine.py is THE authz source of truth —
      route all task/export/push/summary visibility through it in later steps.
- [x] **5. Tasks core** — Task model, create/edit, approval workflow + trusted
      toggle, status rules (assignee/admin direct). DONE + 24 tests (65 total).
      NOTE: Task/RecurrenceRule/TaskOccurrence/Comment models ALL created in this
      migration; step 6 only adds the recurrence ENGINE, step 8 only adds Comment
      endpoints (models already exist).
- [ ] **6. Recurrence engine (TDD FIRST)** — RecurrenceRule, occurrence
      generation, Feb-29/31st/boundary/DST, optional end (date|count), future-only edits.
- [ ] **7. Views API + frontend** — list/weekly/monthly, filters/sort, overview
      tabs (appear only when >1), overdue red flag.
- [ ] **8. Comments** — model + endpoints, visibility-gated.
- [ ] **9. Export** — CSV+XLSX, permission filtering, CSV formula-injection sanitize.
- [ ] **10. Notifications** — Web Push subscribe, daily-push builder (silent if
      empty, DST-safe, once/day), GH Actions cron wiring, approval batching,
      group-chat summary endpoint + button.
- [ ] **11. Hardening** — full §12 edge-case suite (real assertions), security-review on API.
- [ ] **12. Verify** — end-to-end run, verification-before-completion, docs final pass.

## Living docs to keep updated each step
README · docs/architecture.md (+ERD) · docs/api-reference.md ·
docs/deploy-runbook.md · docs/permissions-matrix.md · docs/CHANGELOG.md ·
docs/decision-log.md

## Notes / deviations from plan (append-only)
- (none yet)
