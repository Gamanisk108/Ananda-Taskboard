# Decision Log

Key choices and the reasoning, newest first. Brainstorm decisions are in
`.discovery/build-plan.md` §1; this log captures choices made DURING the build.

## Step 1 — Scaffold
- **Custom `User` model from day one** (email login, global role). Done before the
  first migration because swapping `AUTH_USER_MODEL` later is painful.
- **`accounts.Group` (custom)** for bulk grants, kept distinct from
  `django.contrib.auth.Group` to avoid confusing the permission model.
- **Minimal `DATABASE_URL` parser** in settings instead of adding `dj-database-url`
  — one fewer dependency; SQLite default, Postgres later with no code change.
- **API calls = NetworkOnly in the service worker.** Task data must never be served
  stale from cache; only the app shell is cached offline.
- **JWT (SimpleJWT)** with short access + rotating refresh, tokens held in memory
  on the client (refresh flow) — avoids server session state, fits free-tier.
- **Daily push gated server-side**, cron only "wakes & triggers." Keeps correctness
  (local time, DST, once-per-day) in one place, tolerant of approximate cron timing.
