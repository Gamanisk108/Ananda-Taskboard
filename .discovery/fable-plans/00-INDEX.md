# Fable-5 Leverage Plans — Ananda Taskboard (banked 2026-07-07)

Final-window Fable 5 analysis of the production codebase. Each plan is
self-contained and executable by Opus 4.8 (or Sonnet) without Fable. These
COMPLEMENT existing .discovery plans (api-keys-build.md is complete; no
wargames exist for this project) — nothing here duplicates open punch-list
items in CLAUDE.md, which remain design-tracked.

Ranking = impact per unit of effort, for a production PWA on Render free tier
(gunicorn 2 workers × 4 threads, Neon Postgres).

| # | Plan | One-line rationale | Effort |
|---|------|--------------------|--------|
| 1 | [01-async-web-push.md](01-async-web-push.md) | Web-push HTTP calls run synchronously inside task move/assign/comment requests — each blocks a scarce gunicorn thread for N×RTT; a tiny thread-pool dispatcher removes user-visible latency on the app's hottest write paths. | Small |
| 2 | [02-auth-throttling.md](02-auth-throttling.md) | Login/signup/verify endpoints have NO rate limit (only password-reset does) — unlimited credential-stuffing against a live multi-tenant app; fix is ~20 lines of existing ScopedRateThrottle pattern. | Small |
| 3 | [03-deploy-dist-integrity.md](03-deploy-dist-integrity.md) | The project's #1 footgun ("commit frontend/dist or the deploy silently ships stale UI") becomes a machine-enforced CI gate instead of a human rule — kills a whole recurring failure class. | Small-Med |
| 4 | [04-production-guardrails.md](04-production-guardrails.md) | Fail-fast on insecure SECRET_KEY/DEBUG in prod, HSTS/secure-cookie headers (currently absent), and take `seed_demo` out of EVERY deploy's buildCommand — cheap insurance against silent misconfig. | Small |
| 5 | [05-eslint-zero-baseline.md](05-eslint-zero-baseline.md) | Retire the "~26 pre-existing ESLint errors, don't chase them" baseline to 0 and ratchet it — unlocks the lint gate for all future work (Ananda Connect precedent: Fable run took it to 0). | Medium |

Execution notes:
- Order 1→5 is also a safe execution order; plans are independent.
- Every plan: DO NOT forget the deploy gotcha — any frontend change requires
  `cd frontend && npm run build`, commit `frontend/dist`, push main, verify
  live bundle hash (memory `ananda_taskboard_deploy_verify`). Plan 3 makes
  this machine-checked.
- Backend tests: `cd backend && ./venv/Scripts/python.exe -m pytest -q`.
- CodeRabbit at real checkpoints, ≤3/hr.
