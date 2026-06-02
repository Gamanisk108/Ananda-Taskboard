# Changelog

All notable changes to Ananda Taskboard. Newest first.

## [Unreleased]
### Added
- **Step 3 — Projects & sub-projects.** `Project` + `SubProject` models
  (palette-based color auto-assignment, `members_post_without_approval` toggle),
  auto-created default 'General' sub-project via signal, DB constraint enforcing
  one default per project, admin CRUD viewsets (members read-only, visibility
  stubbed for step 4), Django admin with inline sub-projects. 11 tests — all
  passing (23 total).
- **Step 2 — Accounts & auth.** JWT login (`POST /api/auth/login`, email-keyed) +
  refresh, `GET /api/me` (current user + stable `tree` placeholder), user/group
  serializers, Django admin for `User` (custom create form) and `Group`. 12 tests
  (email normalization, login success/failure, refresh, me auth-gating, role
  flags, group M2M) — all passing.
- **Step 1 — Scaffold.** Django + DRF backend (apps: accounts, projects, tasks,
  permissions, notifications, exporting, events) with env-driven, DB-agnostic
  settings, JWT + CORS + DRF configured, custom email-login `User` + `Group`
  models, `/api/health`, event seam, pytest. React 18 + Vite 5 PWA frontend
  (vite-plugin-pwa, router, date-fns) with `/api` dev proxy. Docs skeleton,
  GitHub Actions daily-push cron, `.env.example`, `.gitignore`, README.
