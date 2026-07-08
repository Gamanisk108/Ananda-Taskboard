# Plan 03 — Machine-enforce the frontend/dist deploy gotcha

**Rank:** 3 of 5 · **Effort:** Small–Medium (~2 h) · **Risk:** Low (CI-only)

## The problem
The project's own CLAUDE.md calls this "THE deploy gotcha (highest-stakes
rule in this file)": Render serves the **committed** `frontend/dist` from a
Python-only build, so any `frontend/src` change pushed without a fresh
`npm run build` + committed dist **silently ships stale UI**. Today the only
defenses are a human rule and a post-deploy bundle-hash comparison ritual
(memory `ananda_taskboard_deploy_verify`). Every session, every agent, every
parallel terminal must remember it — a recurring, silent failure class. Turn
the rule into a CI gate that FAILS LOUDLY when src and dist have diverged.

Deliberately NOT proposed: moving the build onto Render (`npm ci && npm run
build` in buildCommand). It would also work, but it changes the production
build environment (Node version drift, free-tier build minutes/memory,
loss of the "what you committed is what serves" property) — a bigger
one-way-door than a pure CI check. Offer it to Gordon as a follow-up
question, don't do it in this plan.

## Evidence
- `Ananda Taskboard/CLAUDE.md:25-31` — the gotcha, verbatim, flagged
  highest-stakes.
- `render.yaml` buildCommand — Python-only: `pip install … collectstatic …
  migrate … seed_demo`; no Node step, so `frontend/dist` in git IS the
  deployed frontend.
- `backend/config/urls.py` `spa()` — Django serves files straight out of
  `FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"`.
- `frontend/dist/assets/index-jR6drnaQ.js` — hashed bundles exist in git now.
- Repo already uses GitHub (`Gamanisk108/Ananda-Taskboard`, main-commit
  workflow) and has CodeRabbit CI hooks — an Actions workflow fits the
  existing setup.

## Exact change plan
1. **Create `.github/workflows/dist-freshness.yml`** in the Taskboard repo:
   - Trigger: `push` to `main` and `pull_request`, with
     `paths: ["frontend/**"]`.
   - Steps: checkout → `actions/setup-node@v4` (pin the Node major that built
     the current dist — check `node -v` used locally; record it in the
     workflow and in CLAUDE.md) → `cd frontend && npm ci && npm run build` →
     compare rebuilt `dist/` to committed `dist/`.
   - **Comparison must be drift-tolerant, not byte-exact.** Vite output is
     deterministic for identical inputs+deps, but PWA precache manifests
     (vite-plugin-pwa injects a revision hash per file) can differ across
     Node/npm patchlevels. Compare the SET OF HASHED ASSET FILENAMES
     (`ls frontend/dist/assets` before vs after), not file bytes:
     ```bash
     git stash -- frontend/dist   # keep committed dist aside... simpler:
     ls dist/assets > /tmp/built.txt   # after fresh build
     git checkout -- dist && ls dist/assets > /tmp/committed.txt
     diff /tmp/committed.txt /tmp/built.txt
     ```
     (Exact scripting left to the executor; the invariant is: **the committed
     hashed-filename set equals the freshly-built set.** A stale dist ALWAYS
     fails this — content hashes change with src.) Order of operations
     matters: build FIRST into a temp dir (`npm run build -- --outDir
     dist-fresh`), then compare `dist-fresh/assets` vs `dist/assets` listings
     — avoids git-checkout gymnastics.
   - On mismatch: fail with a message that repeats the fix verbatim:
     `cd frontend && npm run build && git add dist && commit && push`.
2. **Also run the frontend tests there** (they're currently local-only):
   `npx vitest run` after the build — free coverage on every push.
3. **Badge/visibility:** none needed; a red X on the commit + GitHub email is
   the alert. The daily triage routine (`triage/ROUTINE.md`) already sweeps
   failures — add "dist-freshness workflow red" to its checklist inputs if
   the routine file lists CI sources (verify; if not, skip).
4. **Update `Ananda Taskboard/CLAUDE.md`** deploy-gotcha section: append one
   line — "CI gate: `.github/workflows/dist-freshness.yml` fails the push if
   dist is stale; the rule above is now machine-checked."
5. **Do NOT touch render.yaml** in this plan.

## Verification
1. Push the workflow on a branch with an intentionally stale dist (edit any
   `frontend/src` string WITHOUT rebuilding) → Action must FAIL.
2. Rebuild + commit dist on the same branch → Action must PASS.
3. Merge to main; confirm the main push runs green.
4. Negative control: a backend-only commit must NOT trigger the workflow
   (paths filter working).

## Risks & abort conditions
- **Risk:** false positives from non-deterministic builds (Node minor drift,
  `npm ci` lockfile vs local `npm install`). The filename-set comparison
  absorbs most; if the Action flaps red on KNOWN-fresh dists twice, **abort
  the strict compare** and downgrade to a heuristic gate: fail only when the
  push touches `frontend/src/**` but no file under `frontend/dist/**` changed
  in the same push (pure git, zero build, catches the actual observed failure
  mode). This fallback is ~20 lines and cannot flap.
- **Risk:** `npm ci` requires a committed, in-sync `package-lock.json` —
  verify it exists and is current before shipping the workflow.
- CI-only change: zero production risk; rollback = delete the workflow file.

🟦 Follow-up question for Gordon (separate decision): want Render to build the
frontend itself (Node step in buildCommand) so committing dist stops being
needed at all? Trade-off: simpler workflow vs. build-env drift + slower/less
predictable free-tier deploys.
