# Visual-regression tests (Playwright)

Catches **design-vs-build pixel drift** automatically. The 2026-06-07 fidelity
audit found many regressions (proj-pills, Delete placement, Unscheduled rename,
stray emoji, mobile layout, etc.) that a committed visual baseline would flag in
CI before they ship.

**WIRED INTO THE QA PASS 2026-06-09** (Gordon directive + playbook §2a): run
`npm run test:visual` before calling any UI work done. Two layers:

1. `taskboard.visual.ts` — full-page screenshot baselines per surface/viewport.
2. `alignment.visual.ts` + `sweeps.ts` — geometry sweeps (no screenshots):
   off-center stretched buttons, hard-clipped text (D42), non-flush connected
   controls (D39). These catch the defect class that BOTH a11y-snapshot QA and
   loose screenshot tolerance are blind to — born from the off-center Sign-in
   label that survived five QA passes.

## One-time setup
```bash
cd frontend
npm install                # picks up @playwright/test (added to devDependencies)
npx playwright install     # downloads the browser binaries
```

## Run
```bash
# against the local Django build (serves committed dist + API on one origin)
cd frontend && npm run build        # dist must be CURRENT — Django serves it
cd backend && ./venv/Scripts/python.exe manage.py runserver 8000 --noreload
PW_BASE_URL=http://localhost:8000 npm run test:visual

# against the deployed build
PW_BASE_URL=https://ananda-taskboard.onrender.com npm run test:visual
```

## Update baselines (after an INTENTIONAL design change)
```bash
npm run test:visual:update
```
Commit the updated PNGs in `tests/visual/__snapshots__/`. Review the diff in the
PR — a baseline change is a design change and should be deliberate. **READ the
regenerated PNGs as images before blessing them** (§2a): a baseline captured
from a buggy build blesses the bug — that is how the off-center login button
got a baseline.

## Hard-won config notes (don't regress these)
- `maxDiffPixels: 250` (ABSOLUTE). The original `maxDiffPixelRatio: 0.01`
  allowed ~13k changed px on desktop — small-but-glaring defects (a ~2k-px
  off-center label) passed as "no change".
- `workers: 1`, serial. Dark-mode tests persist `theme=dark` server-side on the
  shared seed user; parallel workers then screenshot light surfaces dark.
- Dialog tests settle the board first (`gotoView` + networkidle) — the list
  behind a modal otherwise races "Loading…" vs rows and flakes the diff.

## Notes
- Auth uses the seed account; override with `PW_EMAIL` / `PW_PASSWORD`.
- Isolated from unit tests: vitest only runs `src/**/*.test.ts`; `tsc -b` only
  compiles `src`. These specs match `**/*.visual.ts`.
- Covers: login, List/Board/Weekly/Monthly (light) + List (dark), Team /
  Settings / Help dialogs, the Help Us hub (light + dark), Improve
  translations, Translation review, Report-a-problem and Spread-the-word
  dialogs, at desktop-1440 / tablet-834 / mobile-390. Extend
  `taskboard.visual.ts` as new surfaces land.
- Help Us baselines capture the FUNCTIONAL v1 — regenerate deliberately when
  Claude Design's revised handoff lands.
- Pairs with the live-fidelity-audit workflow + QA playbook §2a.
