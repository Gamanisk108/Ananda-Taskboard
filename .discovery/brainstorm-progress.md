---
project: ananda-taskboard
status: complete
current-round: 3
total-rounds: 3
last-updated: 2026-06-02
---

# Ananda Taskboard — Brainstorm Progress

Source spec: `taskboard-goal-brief.md` (fully scoped). Brainstorm focuses on the
§14 open decisions plus build-time gaps. One approval point after the design is
presented, before any execution.

## Round plan
- **Round 1 — Data model & permissions** (§14 #1 sub-projects, #2 conflict rule,
  #3 approval scope, #5 recurrence end)
- **Round 2 — Behavior & output** (§14 #4 overdue, #6 export, #7 empty push, + gaps)
- **Round 3 — Infrastructure & visual direction** (§14 #8 DB+hosting, push setup,
  aesthetic direction)

## Round 1 — Data model & permissions
Status: COMPLETE.

Decisions:
1. **Sub-projects:** Always-default ('General'), hide the layer in UI when it's
   the only one. → Uniform data model: every Task lives under a Sub-project.
2. **Conflict rule:** Most-permissive wins (Member > Viewer); effective access =
   union of direct + group grants.
3. **Approval scope:** Creation + content edits go to Pending Approval; status
   changes by assignees stay direct. **CAVEAT (Gordon):** admins must NOT be
   burdened by constant reviews — design approval to be low-friction (see R2 gap:
   per-sub-project "auto-approve trusted members" toggle + batched approvals).
   This may be tuned later.
4. **Recurrence end:** Optional — indefinite, OR end date, OR after N occurrences.
   End must stop exactly (no off-by-one).

## Round 2 — Behavior & output
Status: COMPLETE.

Decisions:
4. **Overdue:** Flag in views (red) AND include in daily push until resolved.
6. **Export:** CSV + XLSX; CSV formula-injection sanitized.
7. **Empty daily push:** Stay silent (no push when nothing due/overdue).
+ **Approval load fix:** Per-Sub-project 'Members can post without approval'
   toggle (default OFF) → trusted teams post instantly. PLUS one consolidated
   approvals inbox with batched notifications + bulk approve/reject. Directly
   answers Gordon's anti-burden caveat.

## Round 3 — Infrastructure & visual direction
Status: COMPLETE.

Decisions:
8a. **DB:** SQLite now, written DB-agnostic so Postgres is a later config swap.
8b. **Hosting:** Render free tier for Django; **GitHub Actions cron** hits a
    secured endpoint each morning to wake the service + fire the daily push.
    Host-independent, fully free.
+  **Push:** Web Push (VAPID) for Phase A PWA (free, no SDK). Native iOS via
    Capacitor + APNs deferred to Phase B.
+  **Aesthetic:** Clean utilitarian / data-dense (Linear/Notion-adjacent,
    strong color-coding, scannable spreadsheet rows) BUT with **rounded corners
    and a softer/warmer palette**. Keep all density + efficiency of option 1.

## ALL ROUNDS COMPLETE → proceeding to design spec + single approval point.
