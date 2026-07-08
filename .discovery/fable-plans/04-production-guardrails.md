# Plan 04 — Production guardrails: fail-fast config, HTTPS hardening, seed_demo out of the deploy path

**Rank:** 4 of 5 · **Effort:** Small (~1–2 h) · **Risk:** Low

## The problem
Three cheap-insurance gaps in production posture:
1. **Insecure-by-default settings can silently reach prod.** `SECRET_KEY`
   falls back to a hardcoded `django-insecure-…` string and `DEBUG` defaults
   to `True`. render.yaml currently sets both correctly — but one deleted env
   var (dashboard slip, blueprint re-apply, new environment) and prod runs
   with DEBUG pages + a public signing key, **silently**. Django's own
   `check --deploy` flags exactly this.
2. **No HTTPS hardening headers.** Grep of settings.py finds only
   `SECURE_CROSS_ORIGIN_OPENER_POLICY` and `SECURE_PROXY_SSL_HEADER` — no
   `SECURE_HSTS_SECONDS`, no `SESSION_COOKIE_SECURE`, no
   `CSRF_COOKIE_SECURE`, no `SECURE_SSL_REDIRECT`. The Django admin
   (`/admin/`, session-cookie auth) is exposed on the live domain; its
   session cookie is currently sendable over plain HTTP.
3. **`seed_demo` runs on EVERY deploy** (render.yaml buildCommand). Deploys
   are frequent (~15 in one overnight session per CLAUDE.md history). If the
   command is not strictly idempotent — or someone later edits it — every
   push can mutate production data mid-use. Data-touching commands don't
   belong in an unconditional build step.

## Evidence
- `backend/config/settings.py:27-31` — `SECRET_KEY = env("DJANGO_SECRET_KEY",
  "django-insecure-dev-only-…")` and `DEBUG = env_bool("DJANGO_DEBUG", True)`.
- `backend/config/settings.py:269,275` — the ONLY `SECURE_*` settings present
  (COOP + proxy-SSL header); no HSTS/secure-cookie/ssl-redirect anywhere.
- `render.yaml` buildCommand — `… && python backend/manage.py seed_demo`
  (unconditional, every build); envVars set `DJANGO_DEBUG=false` +
  `DJANGO_SECRET_KEY: generateValue: true` (correct today, unguarded).
- `backend/config/urls.py` — `path("admin/", admin.site.urls)` live on the
  public origin.

## Exact change plan
1. **Fail-fast block** at the bottom of `backend/config/settings.py`:
   ```python
   IS_RENDER = bool(env("RENDER"))  # Render sets RENDER=true on all services
   if IS_RENDER:
       if DEBUG:
           raise RuntimeError("Refusing to start: DEBUG=True on Render.")
       if SECRET_KEY.startswith("django-insecure-"):
           raise RuntimeError("Refusing to start: dev SECRET_KEY on Render.")
   ```
   Crash-on-boot beats silently-insecure: Render keeps the previous deploy
   live when the new one fails to boot. (Verify Render's `RENDER` env var is
   present via a one-off log line or Render docs; fallback signal:
   `env("RENDER_EXTERNAL_URL")`.)
2. **HTTPS hardening, gated on the same flag** (NOT on `not DEBUG`, so local
   prod-ish testing stays easy):
   ```python
   if IS_RENDER:
       SESSION_COOKIE_SECURE = True
       CSRF_COOKIE_SECURE = True
       SECURE_SSL_REDIRECT = True   # proxy header already configured (:275)
       SECURE_HSTS_SECONDS = 60 * 60 * 24 * 7  # start at 1 week
       SECURE_HSTS_INCLUDE_SUBDOMAINS = False  # onrender.com is a shared suffix
       SECURE_HSTS_PRELOAD = False
   ```
   HSTS starts LOW (1 week) deliberately — see abort conditions. Never set
   include-subdomains/preload on an onrender.com host.
3. **Remove `&& python backend/manage.py seed_demo` from render.yaml**
   buildCommand. Replace with the documented manual path: run it via Render
   Shell (or a one-off job) when the demo actually needs reseeding. Before
   removing, read `backend/accounts/management/commands/seed_demo.py` and
   record in the commit message whether it was idempotent (context for why
   nothing visibly changes). Also note: buildCommand currently runs `migrate`
   at BUILD time while `backend/Procfile` has a `release: migrate` phase —
   render.yaml's startCommand governs (Procfile unused by blueprint); leave
   migrate in buildCommand, but add a comment in render.yaml saying Procfile
   is legacy/local-only to prevent future confusion.
4. **Run `python manage.py check --deploy`** and fix/annotate any remaining
   warnings it raises (e.g. `X_FRAME_OPTIONS` already covered by middleware,
   referrer-policy default).

## Verification
1. Local: `DJANGO_DEBUG=true RENDER=true python manage.py check` → must raise
   the fail-fast RuntimeError; without `RENDER` → normal dev boot unchanged.
2. Full backend suite green (no test sets RENDER, so zero impact expected).
3. Deploy → live checks:
   - `curl -sI https://ananda-taskboard.onrender.com/api/health` → contains
     `Strict-Transport-Security: max-age=604800`.
   - `curl -sI http://ananda-taskboard.onrender.com/` → 301/308 to https.
   - Log in on the live app (JWT flow unaffected — it's header-based) AND log
     in to `/admin/` (session cookie now Secure).
   - `/api/health` still 200, database "postgresql".
4. Next routine deploy after the render.yaml change: confirm demo org/data
   still intact (seed_demo no longer re-running) and demo login still works.

## Risks & abort conditions
- **HSTS is the one semi-one-way door:** browsers cache it for max-age. Start
  at one week; only raise toward 6–12 months after a week of clean operation.
  **Abort/never** set `preload` or include-subdomains on onrender.com.
- **Risk:** `SECURE_SSL_REDIRECT` loop if the proxy header were wrong — it
  isn't (`:275` already trusts `X-Forwarded-Proto`), and Render sets it; if a
  redirect loop appears post-deploy, flip `SECURE_SSL_REDIRECT=False` via a
  quick commit (rollback path).
- **Risk:** something depends on per-deploy reseeding (e.g. the demo account
  is meant to reset). Check `.discovery/` + `docs/decision-log.md` for a
  deliberate "demo resets each deploy" decision before step 3; if found,
  keep seed_demo but wrap it in an env flag (`RUN_SEED_DEMO=1`) instead of
  removing. When in doubt, gate — don't guess.
- Fail-fast block risk: a false-positive boot refusal blocks deploys — but
  the previous deploy stays live, and the fix (set the env var) is the
  correct fix by construction.
