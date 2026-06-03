# Calendar events: date ranges & weekly recurrence

**Date:** 2026-06-03
**Status:** Approved (Gordon, 2026-06-03)

## Problem

`CalendarEvent` only supports a single date plus a `yearly` flag (birthdays).
We want events to also express:

1. **Date ranges** — a continuous multi-day span (e.g. a 3-day retreat, or a
   class series that runs Jun 7–12).
2. **Weekly recurrence on multiple weekdays** — e.g. "every Saturday **and**
   Sunday for 4 weeks".

The existing task recurrence engine only fires on a single weekday per rule, so
it can't express "Sat + Sun". This feature adds a small, isolated weekly
multi-weekday helper rather than complicating the task engine.

## Decisions (from brainstorm)

- **One mode per event** — an event is exactly one of: `single`, `yearly`,
  `range`, `repeating`. Ranges and repeats do not combine.
- **Repeating = weekly, multi-weekday** only. Tick any weekdays; repeats every
  N weeks. No monthly/yearly recurrence for repeating events (annual birthdays
  remain the separate `yearly` kind). YAGNI.
- **Ends** — a repeating event stops after **N weeks** (`count`), on an
  **until-date** (`end_date`), or never. At most one of the two is set.
- **"For N weeks" counts weeks**, not individual occurrences.
- **Display** — events render as **spanning bars** on Weekly & Monthly,
  visually distinct from task bars (accent style + kind icon), in their own
  lane band so they're never confused with project-colored task bars.

## Data model — `CalendarEvent` (tasks app)

| field | type | used by | meaning |
|---|---|---|---|
| `kind` | char, choices, default `single` | all | `single` · `yearly` · `range` · `repeating` |
| `date` *(exists)* | date | all | single/yearly date, range **start**, or series **anchor** |
| `end_date` *(new)* | date, null | range, repeating | range **end** (inclusive) or repeat "until" date |
| `weekdays` *(new)* | char, default "" | repeating | CSV of ints, Mon=0…Sun=6, e.g. `5,6` = Sat+Sun |
| `interval` *(new)* | posint, default 1 | repeating | every **N weeks** |
| `count` *(new)* | posint, null | repeating | stop after **N weeks** (alt. to `end_date`) |
| `title` *(exists)* | char | all | |

Migration: add fields → data-migrate `yearly=True` → `kind="yearly"` → drop the
`yearly` boolean. The range API still emits a derived `yearly` flag so the 🎂
icon keeps working.

`weekday_list()` helper parses the CSV to `[int]`.

## Recurrence helper (`tasks/recurrence.py`)

```
event_weekly_dates(anchor, weekdays, interval=1, count=None, end_date=None,
                   window_start=None, window_end=None) -> [date]
```

- Weeks indexed from the Monday of `anchor`'s week; active weeks step by
  `interval`. `count` caps the number of **active weeks**.
- A day fires only if `>= anchor`, `<= end_date` (if set), and inside the
  query window.
- `end_date` inclusive; terminate the outer loop once a week's Monday passes the
  bound. Fast-forward toward `window_start` when `count is None` to avoid long
  loops from old anchors. `MAX_SLOTS` guard.
- Pure calendar dates (no tz). Leaves the task engine untouched.

## Backend expansion (`tasks/events_views.py`)

`expand_event(ev, window_start, window_end) -> [ {id, title, kind, yearly, start, end} ]`:

- `single`: one span, `start == end == date` if in window.
- `yearly`: `date.replace(year=yr)` for each year in window (Feb-29 skipped in
  non-leap years, as today).
- `range`: one span `start=date, end=end_date` (true dates, not clipped — the
  frontend clips per week) if it overlaps the window.
- `repeating`: one single-day span per `event_weekly_dates(...)` result.

`EventsRangeView.get` maps all events through `expand_event`, sorted by
`(start, title)`. Output shape changes from `{date,…}` to `{start,end,…}`.

`CalendarEventSerializer` gains `kind, end_date, weekdays, interval, count`
(weekdays via a small `WeekdaysField` ↔ list of ints 0..6) with validation:
- `range` → `end_date >= date`.
- `repeating` → `weekdays` non-empty; at most one of `count`/`end_date`;
  `interval >= 1`.

## Frontend

**EventsManager (Settings.tsx)** — type picker (Single / Yearly / Date range /
Repeating) with conditional fields; weekday toggles shown Sun-first but stored
Mon=0..Sun=6; ends control (never / after N weeks / until date). List rows show
a plain-English summary ("Sat & Sun, 4 weeks from Jun 7") plus **edit** (new) +
delete.

**WeeklyView / MonthlyView** — consume the new `{start,end,kind,yearly}` span
shape. Render events as bars in a dedicated events band: Weekly lane-packs full
spans; Monthly draws one bar segment per week-row a span touches. Distinct
styling + 📌 (range) / 🔁 (repeating) / 🎂 (yearly) / 📍 (single) icon.

**types.ts / api** — update the event/instance types accordingly.

## Tests (pytest, mirroring `test_recurrence.py` / `test_events.py`)

- `event_weekly_dates`: "Sat+Sun ×4 weeks" → 8 dates; `interval`; `count` as
  weeks; until-date; window clipping; anchor mid-week (days before anchor
  excluded).
- Range expansion overlaps/excludes window; yearly still expands per year.
- The `yearly → kind` data migration.
- Serializer validation (range end before start; repeating without weekdays;
  both count and end_date).

## Out of scope

- Combining range + repeat.
- Monthly/"nth weekday" recurrence for events.
- Per-occurrence overrides (events have no per-day state, unlike tasks).
