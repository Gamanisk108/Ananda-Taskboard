# Deploy / Ops Runbook

> Living doc. Target: free-tier hosting, fully free to operate.

## Hosting (Render free tier)
1. Push repo to GitHub.
2. Render → New Web Service → point at `backend/`.
   - Build: `pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput`
   - Start: `gunicorn config.wsgi` (add `gunicorn` to requirements before deploy)
3. Set environment variables from `backend/.env.example`.
4. Frontend: build `npm run build` → deploy `frontend/dist/` as a static site
   (Render static site / Netlify / Cloudflare Pages). Point its `/api` at the
   backend URL (set `CORS_ALLOWED_ORIGINS` on the backend accordingly).

> Free tiers sleep when idle (cold start). Acceptable for in-house use; the daily
> push cron wakes the service.

## Daily push (GitHub Actions cron)
- Workflow: `.github/workflows/daily-push.yml` (runs ~15:00 UTC, manual dispatch available).
- Repo secrets required: `BACKEND_URL`, `DAILY_PUSH_SECRET` (must match the
  backend's `DAILY_PUSH_SECRET` env var).
- The endpoint re-checks admin-set local push time + per-user "sent today" guard,
  so the approximate cron time is fine.

## Web Push (VAPID) keys
Generate once and set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_CLAIM_EMAIL`. (Generation steps added in step 10.)

## Switching to Postgres
Set `DATABASE_URL=postgres://...` and redeploy. No code change (settings parse it).

## Phase B (native, later)
Wrap `frontend/` with Capacitor for iOS/Android store apps + native push (APNs).
Only cost: Apple Developer ~$99/yr, and only if shipping native iOS.
