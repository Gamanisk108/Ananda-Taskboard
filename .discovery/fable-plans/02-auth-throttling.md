# Plan 02 — Rate-limit the authentication endpoints

**Rank:** 2 of 5 · **Effort:** Small (~1 h incl. tests) · **Risk:** Low

## The problem
The live multi-tenant app exposes unauthenticated `POST /api/auth/login`,
`/api/auth/signup`, and `/api/auth/verify` with **no rate limiting at all**.
Only the password-reset trio is throttled (`10/hour`). An attacker can
credential-stuff logins at wire speed against real org data (the demo login
`admin@ananda.test` / `taskboard123` is even published in CLAUDE.md, and
password-reset emails confirm which addresses exist). Signup is also
unthrottled → free bulk org creation (spam orgs already needed a
`delete_org --purge-unverified` cleanup command, per project CLAUDE.md ops
notes). The fix is the exact `ScopedRateThrottle` pattern already used three
times in this file.

## Evidence
- `backend/accounts/views.py:54` — `class LoginView(TokenObtainPairView)`:
  no `throttle_classes`.
- `backend/accounts/urls.py:39,42` — `auth/signup` (SignupView) and
  `auth/verify` (VerifyEmailView): no throttles on those views either.
- `backend/accounts/views.py:519-520, 587-588, 620-621` — the existing
  pattern: `throttle_classes = [ScopedRateThrottle]` +
  `throttle_scope = "password_reset"` (import already at `:13`).
- `backend/config/settings.py:190-192` — `DEFAULT_THROTTLE_RATES` currently
  has only `password_reset`.
- `backend/apikeys/authentication.py` — API-key auth is hash-lookup (no
  brute-force realistic against 256-bit tokens); no change needed there.

## Exact change plan
1. **settings** (`backend/config/settings.py`, extend the dict at `:190`):
   ```python
   "DEFAULT_THROTTLE_RATES": {
       "password_reset": env("PASSWORD_RESET_RATE", "10/hour"),
       "login": env("LOGIN_RATE", "10/min"),
       "signup": env("SIGNUP_RATE", "20/hour"),
       "verify_email": env("VERIFY_EMAIL_RATE", "30/hour"),
   },
   ```
   Rates are per-IP (DRF `AnonRateThrottle` keying for anonymous requests).
   `10/min` login allows fat-finger retries + a small office behind one NAT
   while making stuffing useless; env-overridable if the team ever trips it.
2. **Views** (`backend/accounts/views.py`): add to `LoginView`, `SignupView`,
   `VerifyEmailView` the two-line pattern copied from `:519-520` with scopes
   `"login"` / `"signup"` / `"verify_email"`.
3. **Frontend courtesy (optional but cheap):** in the login error handler
   (find the fetch in `frontend/src/components/Login.tsx`), map HTTP 429 to a
   friendly i18n message ("Too many attempts — wait a minute"). If done, the
   new key must go into ALL 13 locales (`frontend/src/locales/`, parity test
   enforces) and the deploy-dist gotcha applies (build + commit
   `frontend/dist`). If skipping the frontend part, note that DRF's default
   429 JSON detail will surface as a generic error — acceptable v1.
4. **Throttle storage caveat:** DRF throttling uses Django's cache. No
   `CACHES` setting is defined → default `LocMemCache`, which is per-process
   (2 gunicorn workers ⇒ effective limit ≈ 2× the configured rate, and resets
   on deploy). That is FINE for this threat model — document it in a code
   comment. Do NOT add Redis for this.

## Verification
1. New tests in `backend/accounts/` (follow existing test style, e.g. near
   the password-reset throttle tests if present): loop 11 bad-password POSTs
   to `/api/auth/login` → 11th (or earlier) returns 429; a good login within
   limit still 200. Use DRF's `throttle_classes` cache-clear between tests
   (`django.core.cache.cache.clear()` in setup) to avoid cross-test bleed.
2. Full suite: `cd backend && ./venv/Scripts/python.exe -m pytest -q` —
   especially the hardening suite `backend/test_hardening.py` must stay green.
3. Live smoke post-deploy: `for i in 1..12: POST /api/auth/login` with a bad
   password via PowerShell `Invoke-RestMethod` → expect 429 by attempt ~11;
   then confirm a REAL login from the browser still works (LocMem = per
   worker, so may need up to ~22 attempts to trip on prod — that's expected).
4. Confirm the daily-triage routine / API-key clients are unaffected (keys
   don't hit `/api/auth/login`).

## Risks & abort conditions
- **Risk:** office NAT lockout (whole team behind one IP). Mitigation: rates
  are env vars — bump `LOGIN_RATE` in Render dashboard without a deploy.
  **Abort** the strict rate (raise to `30/min`) if Gordon's team reports 429s
  in normal use.
- **Risk:** e2e/QA scripts that log in repeatedly (e.g.
  `frontend/qa/parallel-qa.cjs`, 5–20 headless browsers) may trip `10/min`.
  Check that runner's login pattern first; if each browser logs in once,
  20/min burst is possible → set `LOGIN_RATE` default to `30/min` instead.
  This is the plan's one genuine tuning decision — verify before choosing.
- Rollback = remove two lines per view; zero data risk.
