# Visual-regression tests (Playwright)

Catches **design-vs-build pixel drift** automatically. The 2026-06-07 fidelity
audit found many regressions (proj-pills, Delete placement, Unscheduled rename,
stray emoji, mobile layout, etc.) that a committed visual baseline would flag in
CI before they ship.

## One-time setup
```bash
cd frontend
npm install                # picks up @playwright/test (added to devDependencies)
npx playwright install     # downloads the browser binaries
```

## Run
```bash
# against local preview (default http://localhost:4173)
npm run build && npm run preview &   # in one shell
npm run test:visual

# against the deployed build
PW_BASE_URL=https://ananda-taskboard.onrender.com npm run test:visual
```

## Update baselines (after an INTENTIONAL design change)
```bash
npm run test:visual:update
```
Commit the updated PNGs in `tests/visual/__snapshots__/`. Review the diff in the
PR — a baseline change is a design change and should be deliberate.

## Notes
- Auth uses the seed account; override with `PW_EMAIL` / `PW_PASSWORD`.
- Isolated from unit tests: vitest only runs `src/**/*.test.ts`; `tsc -b` only
  compiles `src`. These specs match `**/*.visual.ts`.
- Covers: login, List/Board/Weekly/Monthly (light) + List (dark), and the Team /
  Settings / Help dialogs, at desktop-1440 / tablet-834 / mobile-390. Extend
  `taskboard.visual.ts` as new surfaces land.
- Pairs with the live-fidelity-audit workflow (workspace CLAUDE.md Rule #11).
```
