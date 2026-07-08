# Fable-5 Leverage Plans — Execution Log

## 2026-07-08 — Plan 01: async-web-push — DONE

**Status:** DONE

**What changed:**
- `backend/notifications/push.py` — added module-level `ThreadPoolExecutor`
  (`_push_pool`, max_workers=4) + `send_web_push_async()` fire-and-forget
  dispatcher + `_run()` wrapper that closes the pool thread's Django DB
  connection after each send (leak prevention). Added `timeout=10` to the
  blocking `webpush()` call.
- `backend/tasks/views.py` — switched all three request-path notify helpers
  (`_notify_admins_moved`, `_notify_mentioned`, `_notify_assigned`) from
  `send_web_push` to `send_web_push_async`. `daily.py` left untouched
  (synchronous, cron path, counts successes — per plan).
- `backend/notifications/test_extra.py` — updated `_capture_push` to
  monkeypatch `send_web_push_async` (not `send_web_push`) so assertions
  right after the request aren't racing a pool thread. Added
  `test_mention_push_dispatch_is_non_blocking`: monkeypatches a slow
  (0.5s) `send_web_push` and asserts the comment-create POST still returns
  in <0.5s — the actual regression this plan targets.

**Test evidence:** `cd backend && ./venv/Scripts/python.exe -m pytest -q`
— full suite green, 100% (9 lines of dots across ~650 tests), `EXIT:0`, no
failures/errors observed in the run.

**Deviations from plan:** none. Plan's suggested lazy-lookup pattern for
`_run` (module-global lookup at call time, not bound at def time) was used
as written so `monkeypatch.setattr("notifications.push.send_web_push", ...)`
still works for tests that patch the low-level function directly (the new
timing test uses this). Existing assignment-push tests were switched to
patch `send_web_push_async` instead, per the plan's explicit "OR update the
test" fallback — necessary because those tests assert on captured payloads
immediately after the HTTP response, which would otherwise race the real
thread pool.

**Frontend:** none touched — deploy-dist gotcha does not apply (per plan).

**Commit:** `0a88dc2` — "01-async-web-push: dispatch Web Push sends off the
request thread" (backend/notifications/push.py,
backend/notifications/test_extra.py, backend/tasks/views.py only; left
`.discovery/api-keys-build.md` and `CLAUDE.md` unstaged — pre-existing
uncommitted changes from a parallel session, not touched).

**Purple-marker items for Gordon:**
- 🟪 Push not smoke-tested live yet (plan step 3: move a task on
  https://ananda-taskboard.onrender.com/ with DevTools Network open and
  confirm PATCH latency + that the push still arrives) — push this commit
  and verify post-deploy.
- 🟪 Watch Neon connection count for a few days post-deploy (plan's
  documented risk: thread-pool + DB connection leak). Abort/rollback path
  if it climbs: revert the three call sites in `tasks/views.py` back to
  `send_web_push` (one line each).

## 2026-07-08 — Plan 02: auth-throttling — DONE

**Status:** DONE

**What changed:**
- `backend/config/settings.py` — `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`
  gained `"login"` (`LOGIN_RATE`, default `30/min`), `"signup"`
  (`SIGNUP_RATE`, default `20/hour`), `"verify_email"` (`VERIFY_EMAIL_RATE`,
  default `30/hour`) — env-overridable, plus a comment documenting the
  LocMemCache per-process caveat (no Redis added, per plan).
- `backend/accounts/views.py` — `LoginView`: added
  `throttle_classes = [ScopedRateThrottle]` / `throttle_scope = "login"`
  (had none before). `SignupView`: had a throttle already but it was
  mis-scoped to `"password_reset"` (shared budget with the reset-request
  endpoint) — changed to its own `"signup"` scope. `VerifyEmailView`: added
  the same throttle pair with `"verify_email"` scope (had none before).
  `GoogleAuthView` left untouched (still `"password_reset"` scope) — not
  named in the plan, out of scope.
- `backend/conftest.py` **(new, not in the original plan text — required to
  make the plan actually work)** — repo-root autouse fixture that clears
  Django's cache before/after every test. Reality check: DRF's
  `ScopedRateThrottle` counts requests in the process-global `LocMemCache`,
  which pytest-django does **not** reset between tests (only the DB is
  rolled back). ~40 existing test files across the suite call
  `POST /api/auth/login` as an incidental login helper for unrelated tests,
  with no prior cache-clearing; a first full-suite run *after* wiring the
  login throttle (before this fixture existed) failed ~50 tests with
  `KeyError: 'access'` — the login helper silently got a 429 with no
  `access` token once the shared throttle bucket filled up mid-suite. This
  fixture is the same pattern the plan's own verification section already
  specifies for the new throttle tests, applied repo-wide instead of
  per-file so it doesn't leave the other ~40 files exposed to the same
  failure mode. (Two existing per-file fixtures doing the same thing —
  `accounts/test_password_reset.py`, `accounts/test_signup.py` — are now
  redundant but harmless.)
- `backend/accounts/test_auth_throttle.py` **(new)** — 4 tests: login
  blocked after its configured rate + a good login within the limit still
  succeeds; signup blocked after its rate; verify-email blocked after its
  rate. Each monkeypatches `ScopedRateThrottle.THROTTLE_RATES[scope]` to a
  fast `2/…` rate for the test rather than looping dozens of times against
  the real default (per plan's spirit, not its literal test sketch).
- **Frontend:** skipped the optional 429→friendly-message mapping in
  `Login.tsx` (plan step 3 marked it optional; DRF's default 429 JSON
  surfaces as a generic error, which the plan calls "acceptable v1"). No
  `frontend/src` changes → deploy-dist gotcha does not apply.

**Test evidence:**
1. First full run (throttle added, conftest fix not yet applied):
   `cd backend && ./venv/Scripts/python.exe -m pytest -q` → ~55 failures,
   all `KeyError: 'access'` in unrelated test files (notifications,
   sharing, tasks, translations, test_hardening, test_reduced_access,
   test_restore, test_trash) — confirmed the cross-test throttle-bleed
   hypothesis before touching anything else.
2. After adding `backend/conftest.py` + the new throttle tests: full rerun
   `cd backend && ./venv/Scripts/python.exe -m pytest -q` → 9 lines of dots
   to `[100%]`, `EXIT:0`, zero failures.

**Deviations from plan:**
- `LOGIN_RATE` default set to `30/min`, not the plan's suggested `10/min`.
  The plan flagged this explicitly as "the plan's one genuine tuning
  decision — verify before choosing" and named the exact reason to check:
  `frontend/qa/parallel-qa.cjs` supports up to `HARD_MAX = 20` concurrent
  headless browsers (`DEFAULT_CONCURRENCY = 5`), each calling its `login()`
  helper once per scenario — a plausible >10/min burst during a QA run.
  Went with the plan's own fallback value.
- Added `backend/conftest.py` (not in the plan's file list) — see above;
  required for the plan's own verification step to actually pass across
  the whole suite, not scope creep beyond it.
- `GoogleAuthView` still shares the `"password_reset"` throttle scope —
  plan named only Login/Signup/VerifyEmail; left as-is.

**Commit:** `3e3bbed` — "02-auth-throttling: rate-limit login/signup/
verify-email endpoints" (`backend/config/settings.py`,
`backend/accounts/views.py`, `backend/accounts/test_auth_throttle.py`,
`backend/conftest.py` only; left `.discovery/api-keys-build.md` and
`CLAUDE.md` unstaged — pre-existing uncommitted changes from a parallel
session, not touched).

**Purple-marker items for Gordon:**
- 🟪 Live smoke test not run (plan step 3: loop 12 bad-password POSTs to
  `/api/auth/login` on the live app, expect 429 by attempt ~11–22 given
  2 gunicorn workers × LocMemCache, then confirm a real login still works)
  — this needs a push + deploy first, which this session does not do.
- 🟦 Consider giving `GoogleAuthView` its own throttle scope too (currently
  shares `"password_reset"`'s 10/hour budget, which is unrelated to its
  actual abuse profile) — out of this plan's scope, flagging for later.

## 2026-07-08 — Plan 04: production-guardrails — DONE

**Status:** DONE (code portions only — infra/deploy steps deferred to Gordon
per this run's rules: no Render API calls, no push, no live smoke tests).

**What changed:**
- `backend/config/settings.py` — added a Render-only guardrail block at the
  end of the file: `IS_RENDER = bool(env("RENDER"))`; if `IS_RENDER`, raises
  `RuntimeError` at import time when `DEBUG` is True or `SECRET_KEY` still
  starts with `"django-insecure-"` (crash-on-boot, Render keeps the prior
  deploy live on a failed boot). Same `IS_RENDER` gate also sets
  `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT = True`,
  and `SECURE_HSTS_SECONDS = 60*60*24*7` (1 week; `INCLUDE_SUBDOMAINS` and
  `PRELOAD` left `False` per the plan's abort condition — never set those on
  a shared onrender.com host).
- `render.yaml` — removed `python backend/manage.py seed_demo` from the
  unconditional `buildCommand`. Checked `seed_demo.py` first: it's
  idempotent-ish by an explicit guard (`if Project.objects.exists(): skip`),
  so it was not actively duplicating data on every deploy, but a
  data-touching command still doesn't belong in an unconditional build step
  per the plan's rationale. Reseeding now requires a manual Render Shell run
  (`python backend/manage.py seed_demo`). Added a comment noting
  `backend/Procfile`'s `release: migrate` phase is legacy/local-only —
  render.yaml's buildCommand (which still runs `migrate --noinput` at build
  time) governs on Render, not the Procfile.
- Searched `docs/decision-log.md` + `.discovery/` for a deliberate "demo
  resets every deploy" decision (per the plan's abort condition) — found
  none, so removed rather than env-flagging.
- `python manage.py check --deploy` run under Render-like env
  (`DJANGO_DEBUG=false RENDER=true` + a realistic 50-char random
  `DJANGO_SECRET_KEY`) — only 2 warnings remain, both the plan's own
  deliberately-deferred ones: `security.W005`
  (`SECURE_HSTS_INCLUDE_SUBDOMAINS`) and `security.W021`
  (`SECURE_HSTS_PRELOAD`). No action needed; matches plan step 4's
  "fix/annotate" — these are annotated (comment in settings.py), not fixed.

**Test evidence:**
1. `cd backend && DJANGO_DEBUG=true RENDER=true ./venv/Scripts/python.exe
   manage.py check` → raised `RuntimeError: Refusing to start: DEBUG=True on
   Render.` at import time, as required.
2. `cd backend && ./venv/Scripts/python.exe manage.py check` (no `RENDER`)
   → `System check identified no issues (0 silenced).` — local dev boot
   unaffected.
3. `cd backend && DJANGO_DEBUG=false RENDER=true
   DJANGO_SECRET_KEY=<50-char random> ./venv/Scripts/python.exe manage.py
   check --deploy` → 2 warnings (W005, W021 — both intentionally deferred
   per plan), no others.
4. Full suite: `cd backend && ./venv/Scripts/python.exe -m pytest -q` → 9
   lines of dots to `[100%]`, `EXIT:0`, zero failures (no test sets `RENDER`,
   so zero impact, as the plan predicted).

**Deviations from plan:** none in the code changes. Plan's optional
verification-step 3 (live curl checks for HSTS header / https redirect /
admin login) and step 4 (confirm demo data intact after next routine deploy)
were NOT run — this session is explicitly code+tests+local-commit only, no
Render API calls, no push, no live checks (see 🟪 below).

**Commit:** `d8a8635` — "04-production-guardrails: fail-fast config, HTTPS
hardening, seed_demo out of deploy path" (`backend/config/settings.py`,
`render.yaml` only; left `.discovery/api-keys-build.md`, `CLAUDE.md`
unstaged — pre-existing uncommitted changes from a parallel session, not
touched; also left untracked `design/Claude Design/Ananda Taskboard.zip` and
`graphify-out/` alone).

**Purple-marker items for Gordon:**
- 🟪 Push this commit (`git push origin main`) to trigger the Render deploy
  — this session does not push.
- 🟪 Post-deploy, run the plan's live verification (plan §Verification
  steps 1 and 3):
  `curl -sI https://ananda-taskboard.onrender.com/api/health` — confirm
  header `Strict-Transport-Security: max-age=604800` is present;
  `curl -sI http://ananda-taskboard.onrender.com/` — confirm 301/308 redirect
  to https; log in on the live app (JWT) AND log in to
  `https://ananda-taskboard.onrender.com/admin/` (session cookie now Secure)
  to confirm both still work; confirm `/api/health` still 200 with database
  `"postgresql"`.
- 🟪 Watch for a failed-boot scenario after this deploy: if the Render
  service fails to come up, check the deploy log for
  `RuntimeError: Refusing to start: DEBUG=True on Render.` or
  `RuntimeError: Refusing to start: dev SECRET_KEY on Render.` — this means
  `DJANGO_DEBUG` or `DJANGO_SECRET_KEY` got unset/reset on the live service
  (dashboard slip, blueprint re-apply); the previous deploy stays live while
  you fix the env var. (render.yaml already sets both correctly, so this is
  a defense against future drift, not an expected failure.)
- 🟪 Next routine deploy after this one: confirm demo org/data (login
  `admin@ananda.test` / `taskboard123`) is still intact now that
  `seed_demo` no longer runs on every build (plan §Verification step 4). If
  the demo data ever needs a manual reseed, run
  `python backend/manage.py seed_demo` via Render Shell.
- 🟪 If a redirect loop appears post-deploy from `SECURE_SSL_REDIRECT`
  (unexpected — the proxy header is already trusted — but the plan names it
  as a risk): rollback path is flipping `SECURE_SSL_REDIRECT = False` via a
  quick follow-up commit.
- 🟦 HSTS is currently 1 week by design (plan's semi-one-way-door caution).
  Consider raising toward 6–12 months only after a week of confirmed clean
  HTTPS operation on the live domain — track this as a deliberate follow-up,
  not automatic.
