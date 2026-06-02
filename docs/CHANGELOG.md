# Changelog

All notable changes to Ananda Taskboard. Newest first.

## [Unreleased]
### Added
- **Step 1 — Scaffold.** Django + DRF backend (apps: accounts, projects, tasks,
  permissions, notifications, exporting, events) with env-driven, DB-agnostic
  settings, JWT + CORS + DRF configured, custom email-login `User` + `Group`
  models, `/api/health`, event seam, pytest. React 18 + Vite 5 PWA frontend
  (vite-plugin-pwa, router, date-fns) with `/api` dev proxy. Docs skeleton,
  GitHub Actions daily-push cron, `.env.example`, `.gitignore`, README.
