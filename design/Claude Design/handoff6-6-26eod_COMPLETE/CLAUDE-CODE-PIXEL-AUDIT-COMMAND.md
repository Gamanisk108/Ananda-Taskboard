# ⌘ Claude Code — Pixel Audit Command
Paste the block below into Claude Code (run from the `design_handoff_COMPLETE/` folder, with
Playwright installed). It audits every HTML page against the design, end-to-end, mobile +
responsive, and collects unresolved discrepancies for you to decide in the morning.

---

You are running a **pixel-fidelity audit** of the Ananda Taskboard design, using **Playwright**.
Do NOT change any design decisions yourself. Your job is to MEASURE, COMPARE, and REPORT.

## Inputs (read first, in this order)
1. `MASTER-HANDOFF.md` — the design system + module index.
2. `CLAUDE.md` — project law (RULE #0 fidelity, RULE #1 decisions log).
3. `DESIGN-DECISIONS-LOG.md` — the authoritative list of cross-cutting decisions (D1–D19).
   **This is the tie-breaker:** if two files differ and the log says which is correct, the
   log wins — record it as "resolved by log", do not ask me.

## What to audit
Every HTML page in the bundle:
- `app/Ananda Taskboard.html`, `app/Ananda Taskboard - Web.html`,
  `app/Ananda Taskboard - Responsive.html`, `app/Ananda Taskboard - Signup.html`
- `mobile/Ananda Taskboard Mobile.html`
- `multitenancy/Ananda Taskboard - Multi-tenancy.html`
- `auth/auth-source.html`
- `help-onboarding/Ananda Taskboard - Help & Subtasks.html`

## Method (per page)
1. Open it in Playwright at **three viewports**: desktop **1440×900**, tablet **834×1112**,
   mobile **390×844**. For each design-canvas page, iterate **every screen/artboard/state**
   (open each modal, popover, dropdown, empty/error state, light AND dark theme).
2. For every screen, **screenshot** it and **extract computed styles** (getComputedStyle) for
   every meaningful element: colors (hex), font-family/size/weight/line-height/letter-spacing,
   padding/margin/gap, border-radius, border, box-shadow, width/height, flex/grid.
3. **Compare like-for-like surfaces ACROSS files** — the same component should be identical
   everywhere it appears (List row, Task Popup, status pill, proj-pill, filter bar, calendar
   bar, buttons, custom dropdowns, avatars). Check every value **to the pixel / exact token**.
4. Check each item against the **Global rules** and the **acceptance checklists** in
   `MASTER-HANDOFF.md` and each module's `HANDOFF.md`/README, and against `DESIGN-DECISIONS-LOG.md`
   (e.g. no native `<select>`; Review is purple `#7a5aa6`; Weekly bars `5px`; Links is a list;
   Delete is left+red; Instrument-Sans titles; Unscheduled naming; etc.).

## Classify every discrepancy
- **AUTO-RESOLVED (by log):** the log dictates the correct version → fix/flag and note "per Dxx".
- **NEEDS MY DECISION:** two pages disagree and the log does NOT cover it → **do NOT guess**.
  Capture: the component, each file's value (with screenshots + exact numbers), the viewport,
  and a one-line plain-English question ("Which is current: A or B?").

## Output (write these files; I'm asleep — no mid-run questions)
1. `audit/PIXEL-AUDIT-REPORT.md` — full results: per page, per screen, per viewport, every
   measured discrepancy with screenshots, grouped by component, each tagged AUTO-RESOLVED or
   NEEDS MY DECISION.
2. `audit/DECISIONS-NEEDED.md` — **only** the NEEDS MY DECISION items, numbered, each as a
   crisp A/B (or A/B/C) choice with thumbnail screenshots and the file+viewport for each
   option, and a blank `MY CHOICE: ____` line. Put EVERYTHING that needs my judgment here so
   I can answer them all in one sitting.
3. `audit/screenshots/` — all captures, named `<page>__<screen>__<viewport>__<theme>.png`.

Run the whole audit start to finish without stopping for input. When done, print a summary:
counts of pages audited, screens checked, AUTO-RESOLVED vs NEEDS MY DECISION, and the path to
`DECISIONS-NEEDED.md`.

## After I answer (next session)
When I fill in `MY CHOICE` for each item, you will: (a) apply the chosen version across ALL
files so they match, AND (b) generate `audit/LOG-UPDATES-for-Claude-Design.md` — a clean,
copy-pasteable list of the resolved decisions in the **exact `DESIGN-DECISIONS-LOG.md` D-entry
format** (what changed before→after · exact spec · affected surfaces) so I can hand it to
Claude Design to append to the log for the future.
