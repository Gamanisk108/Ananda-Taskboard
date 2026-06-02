# Deploy / Ops Runbook

> Living doc. Target: free-tier hosting, fully free to operate.

## Hosting — easiest: one Render service (serves app + API together)
The repo includes `render.yaml` (a Blueprint). Because Django now serves the built
React app, the whole thing runs as **one free web service** — no separate frontend
host, no CORS.

Beginner steps (≈15 min, needs a free GitHub + Render account):
1. Push this repo to GitHub (ask Claude to do this, or use GitHub Desktop).
2. Render.com → **New → Blueprint** → pick the repo. It reads `render.yaml`.
3. When prompted, fill the `sync:false` env vars:
   - `DJANGO_ALLOWED_HOSTS` = `your-app.onrender.com`
   - `DJANGO_CSRF_TRUSTED_ORIGINS` = `https://your-app.onrender.com`
   - VAPID keys (optional, for push — see below).
   (`DJANGO_SECRET_KEY` and `DAILY_PUSH_SECRET` are auto-generated.)
4. Click deploy. When it's live, open `https://your-app.onrender.com` in any
   browser, on any device — log in. **This is the "open from anywhere" goal.**
5. First admin: Render Shell → `python backend/manage.py seed_demo` (demo data) or
   `python backend/manage.py createsuperuser` (just an admin), then use the in-app
   **Team** panel for everyone else.

> The Blueprint's build step runs `npm install && npm run build` (Render images
> include Node), so the frontend is compiled on deploy — nothing to commit.
> Free tier sleeps when idle (cold start); the daily-push cron wakes it.

### Alternative: two services
If you prefer, deploy `frontend/dist` as a Render Static Site and `backend/` as a
Web Service, and set `CORS_ALLOWED_ORIGINS` to the static site's URL.

## Daily push (GitHub Actions cron)
- Workflow: `.github/workflows/daily-push.yml` (runs ~15:00 UTC, manual dispatch available).
- Repo secrets required: `BACKEND_URL`, `DAILY_PUSH_SECRET` (must match the
  backend's `DAILY_PUSH_SECRET` env var).
- The endpoint re-checks admin-set local push time + per-user "sent today" guard,
  so the approximate cron time is fine.

## Web Push (VAPID) keys
Generate once and set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_CLAIM_EMAIL`. (Generation steps added in step 10.)

## Production security checklist (see docs/security-review.md)
- Set `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, real
  `DJANGO_ALLOWED_HOSTS` + `DJANGO_CSRF_TRUSTED_ORIGINS`, long random
  `DAILY_PUSH_SECRET`, and `CORS_ALLOWED_ORIGINS` = your frontend origin.
- Consider enabling DRF login throttling (recommended; omitted from defaults so
  tests aren't rate-limited).
- Enable `SECURE_SSL_REDIRECT` / HSTS once the domain is fixed.

## Switching to Postgres
Set `DATABASE_URL=postgres://...` and redeploy. No code change (settings parse it).

## Phase B (native, later)
Wrap `frontend/` with Capacitor for iOS/Android store apps + native push (APNs).
Only cost: Apple Developer ~$99/yr, and only if shipping native iOS.
