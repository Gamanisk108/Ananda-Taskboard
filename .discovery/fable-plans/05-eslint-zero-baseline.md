# Plan 05 — Retire the "~26 pre-existing ESLint errors" baseline to zero, then ratchet

**Rank:** 5 of 5 · **Effort:** Medium (~2–4 h, mostly mechanical) · **Risk:** Low

## The problem
The project carries a standing exemption — `Ananda Taskboard/CLAUDE.md:70`:
"ESLint baseline: ~26 pre-existing errors — don't chase them in unrelated
work." A permanent non-zero baseline means the lint gate is effectively OFF:
no agent or CI can distinguish "the 26 old ones" from "3 new ones I just
introduced," so lint regressions accumulate unnoticed and every quality gate
(Global Phase 7, qa-testing-playbook) runs with an asterisk. Precedent: the
2026-07-01 Ananda Connect Fable run took that project's ESLint to 0 and it
stuck (memory `project_ananda_connect_fable_run`). This is the classic
broken-windows fix: pay once, then a zero-tolerance ratchet is nearly free to
hold.

## Evidence
- `Ananda Taskboard/CLAUDE.md:70` — the documented baseline exemption.
- `frontend/eslint.config.js` — flat config, ESLint 10, includes the custom
  `local/no-emoji-icon` rule with a centralized `allow` array (the workspace
  reference implementation — must be preserved, per C:\AI\CLAUDE.md
  "Lint/format references").
- `frontend/package.json` devDependencies — `eslint ^10.3.0`,
  `eslint-plugin-react-hooks ^7.1.1`, React 19.
- Hot files most likely to hold the errors (largest components):
  `frontend/src/components/Settings.tsx` (848), `common.tsx` (769),
  `TaskModal.tsx` (696), `TeamAdmin.tsx` (536), `App.tsx` (660).
- No lint step exists in CI (no workflows dir before Plan 03 lands).

## Exact change plan
1. **Measure first:** `cd frontend && npx eslint src --format stylish` and
   save the full output (count may have drifted from ~26 since 2026-06-10 —
   an earlier quick run in this analysis produced no parseable output, so
   treat the true count/mix as unknown until this step). Classify into:
   (a) auto-fixable (`--fix`), (b) mechanical manual (unused vars, missing
   deps annotations), (c) judgment calls (genuine `react-hooks/exhaustive-deps`
   complaints, `no-emoji-icon` hits).
2. **Fix in that order.** Hard rules for category (c):
   - `exhaustive-deps`: FIX the dependency array or restructure (usually
     `useCallback`/moving a value inside the effect). An inline
     `eslint-disable-next-line` is allowed ONLY with a one-line reason
     comment, and at most a handful — this is behavior-adjacent, so each such
     fix must be smoke-tested in the affected surface (open the component,
     exercise the flow).
   - `no-emoji-icon`: legitimate intentional emoji go into the config's
     central `allow` array (NEVER inline disables — that's the whole point of
     the centralized pattern, memory `feedback_reuse_existing_ui_patterns` /
     workspace CLAUDE.md).
   - Never change runtime behavior to silence a rule; if a fix would, stop
     and list it as a deferred item instead.
3. **Ratchet:** once at 0, add `"lint": "eslint src --max-warnings 0"` to
   `frontend/package.json` scripts, and append a lint step to the Plan-03 CI
   workflow (or its own small workflow if Plan 03 wasn't executed):
   `npm ci && npm run lint`. Local hook optional — CI is the ratchet.
4. **Update `Ananda Taskboard/CLAUDE.md:70`:** replace the baseline exemption
   with "ESLint is at 0 and CI-enforced — keep it there." (This CLAUDE.md
   edit is within scope: it's syncing a doc to a verified new reality, and
   it's the project's own file, not the workspace/global one.)
5. **Type-check while in there (free rider):** run `npx tsc --noEmit`; if it
   is already clean, add it to the same CI step; if not, record the count as
   a follow-up — do NOT expand this plan's scope to TS fixes.

## Verification
1. `npx eslint src` → exit 0, zero errors AND zero warnings.
2. `npm run build && npx vitest run` → all green (proves no behavior broke).
3. Because component files changed: **the deploy gotcha applies** — rebuild,
   commit `frontend/dist`, push, and verify the live bundle hash matches
   local (memory `ananda_taskboard_deploy_verify`).
4. Live spot-check (Playwright or manual) of every surface whose
   `exhaustive-deps`/hooks code was touched: open it, exercise its main flow,
   watch the console for new errors — hooks-deps fixes are the one category
   that can subtly change behavior (extra refetches, stale closures fixed =
   different timing).
5. CI: push a deliberate lint error on a branch → workflow red; revert →
   green.

## Risks & abort conditions
- **Main risk:** an `exhaustive-deps` "fix" introduces an effect re-run loop
  or extra network chatter. Mitigation: per-fix live smoke (verification 4);
  keep each fix in its own small commit so `git revert` is surgical.
- **Abort condition:** if measurement (step 1) reveals the errors are
  dominated by a rule whose fixes are all behavior-adjacent (e.g. 20+
  exhaustive-deps in the data-loading core of `App.tsx`), STOP after the
  mechanical categories, ship the partial reduction + ratchet at the new
  lower number (`--max-warnings` equivalent via count check), and flag the
  remainder as a deliberate refactor task (likely wants the TanStack-Query
  read migration as its vehicle) rather than forcing risky one-line fixes.
- Do not touch the ~13-locale files or `frontend/dist` by hand; dist changes
  only via `npm run build`.
