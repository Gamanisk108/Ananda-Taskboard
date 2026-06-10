# Ananda Taskboard — Project Rules (read me before working here)

The flagship production app: an installable PWA task board for a small in-house
team. Hierarchy **Project → Sub-project → Task (→ Subtask, one level)**, with
list/weekly/monthly views, recurring tasks, approvals, 13 locales, light+dark.
**Live:** https://ananda-taskboard.onrender.com/ (login `admin@ananda.test` /
`taskboard123`). **Repo:** GitHub `Gamanisk108/Ananda-Taskboard`, branch `main`
(commit-to-main workflow). Created 2026-06-09 by consolidating the former root
`RESUMEFUNCTION.md`, README, and scattered session notes into one governing file.

## Stack & layout
- `backend/` — Django + DRF, SQLite (Postgres-ready via `DATABASE_URL`), Web
  Push (VAPID). Tests: `cd backend && ./venv/Scripts/python.exe -m pytest -q`.
- `frontend/` — React 18 + Vite 5 + TypeScript PWA. Tests:
  `cd frontend && npm run build && npx vitest run`. Playwright
  visual-regression scaffold + `playwright.config.ts` present.
- `design/` — Claude Design references. **Source of truth for visuals** =
  `design/Claude Design/handoff6-6-26eod_COMPLETE/` → its `CLAUDE.md` (brand
  rules) + `DESIGN-DECISIONS-LOG.md` (D1–D36+, the tie-breaker on any
  spec-vs-build divergence). Read both before any UI work.
- `docs/` — architecture, api-reference, permissions-matrix, deploy-runbook,
  design-system, CHANGELOG, decision-log.
- `.discovery/` — build-plan.md + BUILD-STATE.md (resume points).

## ⚠️ THE deploy gotcha (highest-stakes rule in this file)
Render serves the **committed `frontend/dist`** (Python-only build). After ANY
`frontend/src` change you MUST `cd frontend && npm run build`, **commit
`frontend/dist`**, then push `main` — or the deploy silently won't reflect the
change. Deploys take ~3–5 min; the PWA service worker may need a cache-bust
reload. **Verify every deploy** by comparing the live bundle hash to the local
one (see memory `ananda_taskboard_deploy_verify`).

## Hard rules (carried from the design handoff — non-negotiable)
- FIRST: the universal `C:\AI\deep-dives\design-constitution.md` applies on
  top of everything below (asset integrity, alignment, no clipping, etc.).
- **Rule #0 Fidelity-first:** recreate existing agreed designs 100% faithfully
  (read the real source, copy it) BEFORE layering anything new. Never ship a
  simplified approximation of an existing surface.
- **Rule #1 Log every decision:** every design decision goes in
  `DESIGN-DECISIONS-LOG.md` the moment it's agreed (before → after · exact
  spec · affected surfaces). Not in the log = it didn't happen.
- Fonts: Instrument Sans (ALL UI + titles, h1–h3 weight 700) · Fraunces ONLY
  the wordmark + tagline · Red Hat Mono (numbers). Gordon has rejected
  Fraunces titles repeatedly.
- Statuses: FIVE, in order — To Do (gray) · In Progress (blue) · Delayed (red)
  · Review (purple `#7a5aa6`) · Done (green). All five, everywhere.
- No native `<select>` carets — custom trigger + popover everywhere (D2);
  `SingleSelect` component is the standard.
- Icons: line-art, never emoji (exception: project-picker emoji).
- Text is NEVER hard-clipped (D42, formerly D36): ellipsis + title, "+N"
  overflows, `min-width:0` on flex/grid children.
- Form spacing: ONE step everywhere — `--gap-form:13px` token, never stacked
  margin+gap on the same boundary (D35).
- Connected controls perfectly aligned — side-by-side = flush both edges /
  equal height; stacked = shared edge; button groups align as a unit (D39).
- Devotional quotes (D40): roster Yogananda/Lahiri/Sri Yukteswar/Babaji/
  Kriyananda (+ Jesus VERY sparingly); max one per surface, celebratory
  moments only; lite = warm-gold Fraunces italic epigraph between title and
  description; boxed `TRB.quote` only for full-screen thank-you/all-done;
  accuracy sacred — verify wording or ask.
- Buttons: primary filled navy `#1e3a6e`; danger red `#b4452f`; **Delete on
  the LEFT in red** in dialog footers; styled confirm dialogs (no native
  `confirm`). Modal closes on backdrop click AND Escape (verified in code
  2026-06-10 — an earlier note here claiming "not Escape" was stale).

## Dev gotchas (from hard-won memories)
- **Zombie servers:** before any QA, loop-kill ALL listeners on :8000 and
  :5173–5175 — stale `runserver`s serve old code (caused a phantom 405).
- i18n: every new key goes in ALL 13 locales (a parity test enforces).
- ESLint baseline: ~26 pre-existing errors — don't chase them in unrelated work.
- CodeRabbit: `.coderabbit.yaml` committed; ≤3 reviews/hr, offer at real
  checkpoints (cr-nudge hook reminds).
- QA standard: the full **permutation matrix** from
  `C:\AI\deep-dives\qa-testing-playbook.md` §7 — populated states, every
  status/priority/role/locale, light+dark, mobile widths (390/834 via
  Playwright against the LIVE build).

## Current state (as of 2026-06-10; verify against git log before trusting)
**2026-06-10 full review (this supersedes most of the below):** Help Us v2
(D44–D48) merged + live via PRs #2–#7. The review session then produced PRs
**#8 (QA conformance: PWA icons, Unscheduled clip fix, Archive-toggle fix,
DN3/DN4/DN5, translation moderation, a11y)**, **#9 (mobile native-feel shell:
app bar, drawer+duser, bottom tab bar, full-screen dialogs)**, **#10
(professional layer: /privacy + /terms, account deletion, demo account,
env-gated Sentry)** — stacked, AWAITING GORDON'S MERGE + deploy verify.
Punch-list + coverage: `qa/qa-2026-06-10-findings.md`. Still open after merge:
compact `.trow` Trash/Approvals rows at 390; Save-in-header for the
full-screen task view (❓ Design); APR-4 member pending-feedback (❓ Design);
i18n native-speaker pass; R2 + Sentry env vars (Gordon).

### Older state (2026-06-08)
Desktop conformance ~70% (DN2 selects done; subtasks D11/D12 rebuilt; D7/D13
unscheduled table done). **Mobile is the biggest remaining chunk** (~10%; only
List→cards done): nav drawer, bottom sheets, full-screen task routes, Board/
Weekly/Monthly treatments. Also open: DN3 Holidays→Settings, DN5 Archive→
account menu, DN4 filter scoping, DN12 assignee picker (E3), proj-pills on
Trash/Copy rows, i18n for renamed keys. Ops: confirm Render email (password
reset via Resend), purge test orgs (`delete_org --purge-unverified`).
**Help Us / Community Translations (D36–D43): FUNCTIONAL v1 LIVE 2026-06-09**
(deployed to Render, smoke-tested: health/login/overrides/review/feedback
validation all green) — backend `translations` + `feedback`
apps, runtime override resolution, member-visible Settings section-nav,
contributor + superadmin-poll + the three flows. Rulings + open design asks
live in `design/Claude Design/Ananda Taskboard Help Us Handoff/
design_handoff_community_translations/CODE-AUDIT-FEEDBACK.md` (§12). The
VISUAL fidelity pass is DEFERRED until Claude Design's revised handoff
(Account/Notifications panes, reframed contributor copy, referral card,
placeholder states, heart-hands SVG). Still pending: `--gap-form` rollout
(D35) · alignment retro-audit (D39).
Detailed pointers: `design/.../handoff6-6-26eod_COMPLETE/audit/RESUME.md`.
