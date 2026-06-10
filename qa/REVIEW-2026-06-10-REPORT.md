# Full Review — 2026-06-10 ("make it incredible" session)

Gordon asked: review the Taskboard, find what's missing, make it professional,
make sure everything works. This is the complete record; the chat summary
points here. Detailed QA punch-list + coverage: `qa-2026-06-10-findings.md`.

## What was found (the headline bugs — all fixed)

1. 🔴 **The PWA's install icons never existed.** The manifest pointed at
   `pwa-192.png`/`pwa-512.png`, which were never in the repo — every
   Android/desktop install since launch had a broken icon, and the browser
   tab showed an off-brand purple template icon instead of the lotus.
   → Real icons generated from the lotus mark (downscale-only, navy canvas
   for the 512 maskable), `apple-touch-icon` added, favicon now the real mark.
2. 🔴 **"Unscheduled Tasks" showed an empty box.** The table existed in the
   DOM but a CSS-animation side-effect (a retained `transform` on a `.rise`
   ancestor) trapped the modal's positioning and clipped it to nothing.
   → The shared Modal now portals to `<body>` (fixes the whole bug class).
3. 🔴 **The Archive toggle never worked.** The button toggled its own styling
   but the flag was never passed into the views — clicking "Archive" changed
   nothing. Found while verifying the DN5 move. → Fixed properly.
4. 🟠 Dark-mode "Unscheduled Tasks" button was ~2:1 contrast (AA fail) →
   azure accent in dark. Login wordmark wasn't Fraunces and lacked the gold
   tagline → matches the brand row now. Approvals reject had no confirm →
   confirms now (single + bulk). Team had a duplicate Holidays tab (DN3) →
   removed. Long select labels overflowed cards on phones → ellipsize (D42).
5. 🟡 Boot fired an unauthenticated `/api/me` → red console error on every
   load → token now refreshes before the first call. `platform.tier` was
   mistranslated ("Level") in all 12 non-English locales → "View Access".

## What was added

- **Translation moderation** (was missing entirely — a junk/abusive
  suggestion could sit in the community poll forever): contributors can
  withdraw their own suggestion; superadmin can dismiss any variant. Two new
  DELETE endpoints, confirm dialogs, 5 pytest cases.
- **Approvals pending-count badge** on the nav button (admins can now SEE
  work waiting).
- **Mobile native-feel shell** (the biggest remaining design chunk): 54px
  app bar (hamburger · brand · navy + · kebab), a full drawer (admin nav,
  account actions, what's-new dots, user footer with theme toggle), a bottom
  tab bar for the four views, and full-screen dialog treatment for 27
  dialogs with hardware-Back support.
- **Professional layer:** hosted `/privacy` + `/terms` (real content, linked
  from Login + Settings), in-app **account deletion** (password re-auth,
  sole-admin guard, FK-audited cascade), a **read-only demo account**
  command for store review, and **Sentry error monitoring** on both ends
  (dormant until a DSN is set). App-store-readiness Phase 1 is now done.

## Conformance closed this session
DN3 (Holidays→Settings, leftover tab removed) · DN4 (filter scoping +
stale-filter reset) · DN5 (Archive→account menu) · proj-pills on
Copy-summary + Approvals · D42 modal-table scrolling · `.tcard` alignment ·
auth-screen brand typography · 21 new i18n keys ×13 locales (parity green).

## The three PRs (stacked, in order)
| PR | Branch | Contents |
|---|---|---|
| #8 | `fix/qa-2026-06-10-conformance` | All QA fixes + conformance + moderation. CodeRabbit reviewed: 2 findings fixed, 2 declined with replies. |
| #9 | `feat/mobile-shell` (base: #8) | Mobile shell + full-screen dialogs. |
| #10 | `feat/professional-layer` (base: #9) | Legal pages, account deletion, demo account, Sentry. |

Gates on every PR: tsc clean · eslint at the 27-error baseline · vitest
82/82 · backend pytest full pass (now ~165 incl. 10 new) · i18n parity ·
`frontend/dist` rebuilt + committed (the Render deploy gotcha).

## Verified
- Phase-1 live QA: every major surface at 1440/390, light+dark, member+admin
  roles, populated states (subtasks, comments, trash, approvals end-to-end,
  all 5 statuses, translation save→poll round-trip). Test data cleaned up
  (statuses reverted, approval rejected, subtask/comment deleted).
- Each fix re-verified in a real browser locally (localhost:5173 + :8000)
  before commit: Unscheduled table renders, Archive round-trips, DN4 filter
  sets per scope, fs task view + hardware Back, drawer/tabbar/kebab,
  /privacy renders, demo command idempotent.
- NOT yet verified live (blocked on merge): the deployed result. Post-merge
  checklist below.

## Deferred (logged, no silent caps)
- Compact `.trow` rows for Trash/Approvals at 390 (tables x-scroll
  acceptably; native-feel polish).
- ❓ Design rulings needed: Save-in-header for the full-screen task view
  (footer Save kept for now) · APR-4 member feedback while a task awaits
  approval (currently silent) · D35 `--gap-form` retro-sweep + D39 alignment
  retro-audit (run the visual suite against the deployed build post-merge).
- i18n native-speaker pass (Indic `noDate` + the 20 new keys, best-effort
  translations flagged).
- Approvals badge polls with the standard cache (refreshes on task changes +
  ~30s stale time) — real-time push later if wanted.

## 🟡 GORDON — your moves (in order)
1. 🟡 **Merge the PRs in order: #8 → #9 → #10** (each is green; #9/#10
   retarget automatically as the previous one merges). Merging #10 deploys
   everything to Render (~3–5 min). The session's auto-merge attempt was
   blocked by the permission gate — your call by design.
2. 🟡 After deploy, say the word and I (any session) run the **post-merge
   verification**: live bundle-hash check, smoke the fixed flows, run the
   visual-regression + geometry sweeps, dismiss the leftover QA translation
   suggestion ("Salvare (QA test)", Italian) with the new moderation tool,
   and `python manage.py create_demo_account` on Render if you want the demo
   login live.
3. 🟡 **Sentry (~10 min):** create a free account at sentry.io → new Django
   + React projects → set `SENTRY_DSN` (backend) and `VITE_SENTRY_DSN`
   (frontend build env) on Render. Until then monitoring stays dormant.
4. 🟡 **R2 media uploads** (from the v2 work, still dormant): follow
   `docs/r2-media-setup.md` to set the four R2 env vars + bucket CORS.
5. 🟡 **Resend email envs** (carried over): confirm `EMAIL_BACKEND`,
   `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` on Render.
6. 🟡 **Stale branch cleanup (gated proposal):** `worktree-reduced-access-
   parity` (superseded pre-tenancy implementation), `phase2-extras`
   (experimental webhooks), worktree `integrate-reduced-access` (102 commits
   behind), plus the old merged feature branches. Say yes and they get
   archived/deleted.
7. 🟡 The three deleted design `.zip`s sitting uncommitted in git status
   (you or a prior session deleted the files): say yes to commit the
   deletions (the extracted folders are all in git).

Aum, Peace, Amen.
