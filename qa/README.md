# QA — Ananda Taskboard

This folder holds **every QA run** for the app, structured so it scales to many runs
over time. Read this first to orient; each run is a self-contained dated folder.

## Layout

```
qa/
├── README.md          ← you are here: the system + the run index
├── TEMPLATE.md        ← copy this to start a new run's report.md
├── runs/              ← one folder per QA run (the canonical record)
│   └── YYYY-MM-DD[-tag]/
│       ├── report.md  ← findings + resolution for that run
│       └── shots/     ← screenshots referenced by report.md
├── scripts/           ← reusable QA tooling (Playwright/seed/screenshot/kill)
└── archive/           ← superseded ad-hoc artifacts kept for history
```

### Naming a run folder
- One run per day → `runs/2026-06-05/`.
- Multiple in a day or a themed pass → add a tag: `runs/2026-06-07-mobile/`,
  `runs/2026-06-07-pm/`, `runs/2026-06-09-hotfix/`.
- Never rename or overwrite an old run folder — runs are an append-only history.
  A later run that re-tests the same area is a **new** dated folder that links back.

## How to do a QA run

1. **Start the app** (both servers must run together): Django on `:8000`, Vite on
   `:5173` (Vite proxies `/api`). `scripts/kill-servers.ps1` frees stuck ports.
2. **Create the run folder**: `runs/<date>/` with an empty `shots/`.
3. **Copy `TEMPLATE.md` → `runs/<date>/report.md`** and fill the header.
4. **Drive the LIVE app via the Playwright MCP server** (standing rule — not just unit
   tests). For each affected flow: log in, navigate, screenshot into `shots/`, check
   the browser console + network for errors, then critique.
5. **Apply the QA lenses** (see below). Log findings as **[BUG] / [UX] / [POLISH]**,
   each with a screenshot reference and a fix recommendation.
6. **If you fix findings in the same session**, add a top-of-report **Resolution**
   table (finding → fix → files) and update this README's run index status.
7. **Update the run index** below.

## QA lenses (apply every run)

- **UX critique:** (1) clarity for non-technical users, (2) efficiency / fewest clicks
  for frequent tasks, (3) visual fidelity to design references.
- **Exhaustive rigor:** light **and** dark mode; the full permission/tier matrix
  (Volunteer → Coordinator → Lead → Admin → viewer); edge cases & rapid multi-click;
  guardrail-gap hunting (does the UI prevent the mistake, or only fail after?);
  performance/fluidity (no unwanted reloads, contained scroll, fast API).
- **Three-layer "done" bar:** a fix isn't done until all three pass — static health
  (`npx fallow`), unit/scripted tests (pytest + vitest), and live browser/UX QA.

Output is honest expert heuristic critique + functional testing — not a real user's
lived reaction. Flag spots that warrant human eyes.

## Run index

| Run | Scope | Findings | Status |
|-----|-------|----------|--------|
| [2026-06-05](runs/2026-06-05/report.md) | Full app sweep (auth, CRUD, approvals, permissions/tiers, 4 views, projects, trash/archive/history, export/import, signup+verify, password reset, i18n×13, multi-tenancy, dark mode, overflow stress) | 5 🔴 bugs, several 🟡 UX/polish | ✅ **All fixed** same session (see report's Resolution table) |

_Add a row per run, newest at the top is fine too — keep it scannable._

## Scripts

`scripts/` holds the reusable Playwright/screenshot/seed helpers used across runs
(e.g. `webapp_smoke.py`, `e2e_signup.py`, `locale_shots.py`, `tier_check.py`,
`kill-servers.ps1`). Prefer extending these over writing throwaway one-offs; a script
worth keeping lives here, a true throwaway does not get committed.
