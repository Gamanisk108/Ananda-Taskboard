# Two rulings needed from Claude (Design) — Ananda Taskboard, 2026-06-11

*From the 2026-06-10 full review (Code). Both are built-and-live with an
interim treatment; we need the designed treatment confirmed or corrected.
Paste this file into a Claude (Design) session; answers go into
DESIGN-DECISIONS-LOG.md as new D-numbers.*

---

## Q1 — Full-screen task view (phones): where does Save live?

Build state: on phones every large dialog is now a full-screen view with the
design `.fs-head` (back chevron · title · #id chip). The mobile design's
`taskDetail()` puts a **filled `.save` button in the fs-head** and a
full-width danger-outline **Delete at the bottom of the body**.

The interim build instead **keeps the existing sticky footer**
(Delete-left · Share · Cancel · Save) under the full-screen body — fewer
moving parts and one shared footer across create/edit, but it deviates from
the mock.

**Decide:** A) move Save into the fs-head + Delete to body-bottom per the
mock (and what happens to Share/Cancel?), or B) bless the sticky footer as
the standard full-screen treatment (then the mock should be updated).

## Q2 — Member feedback while a task awaits approval (APR-4)

When a member creates a task that needs admin approval, the task simply
**vanishes from their board** until approved. There is a transient toast at
best — nothing durable. Members can't tell submitted-and-pending apart from
failed-to-save.

**Decide the treatment:** e.g. (A) the member sees their own pending task
in place with a "Waiting for approval" pill (read-only), (B) a "Pending
approval (N)" row/section at the top of their List view, (C) a notice in
the account menu / drawer, or (D) something else. Backend has
`approval_state` already; any of these is buildable.

---

*Context files: `qa/REVIEW-2026-06-10-REPORT.md` (what shipped) ·
`qa/qa-2026-06-10-findings.md` APR-4 · mobile design refs in
`design/Claude Design/handoff6-6-26eod_COMPLETE/mobile/`.*
