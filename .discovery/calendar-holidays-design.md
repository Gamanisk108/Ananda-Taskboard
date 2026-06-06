---
project: ananda-taskboard
feature: calendar-holidays
status: design-approved
last-updated: 2026-06-05
---

# Calendar Holidays — Design Spec

## Goal

The Weekly and Monthly calendars should automatically display holidays, accurate
every year with no manual upkeep for the computable ones. Holiday sets are
**chosen by the organization admin** (not per-user), and the system is built so
other countries (Italy, etc.) can be added later without code surgery.

Holiday sets for the initial (Ananda) organization:
- **US Federal** (`us_federal`)
- **US civil observances** (`us_observances`) — Mother's Day, Father's Day,
  Daylight Saving begins/ends (computed by weekday rules)
- **US Christian / religious** (`christian`)
- **Hindu / yoga festivals** (`hindu_festivals`) — Shivaratri, Diwali, …
- **Ananda / SRF lineage days** (`ananda_lineage`) — guru birthdays &
  mahasamadhis + Ananda milestones

**Authoritative source:** Ananda's own published calendar
(`ananda.org/thank-you-god`, see `design/Ananda Holidays.jpeg`). Lineage and
festival dates are taken from there, not guessed.

## Non-goals

- Per-user holiday toggles (admin-controlled only for now).
- Editing/deleting holidays as if they were org events (they are read-only,
  system-computed).
- Timezone-aware holiday times (holidays are whole-day, plain `YYYY-MM-DD`,
  matching the existing calendar).

## Accuracy strategy (per set)

Holidays move for different reasons; each set uses the cheapest reliable method.

| Set | Method | Maintenance |
|-----|--------|-------------|
| US Federal & country packs | Python `holidays` library | None — auto-handles "observed" shifts (e.g. Jul 4 on Sunday → Mon). Add a country = add a code. |
| US civil observances | Weekday rules: Mother's Day = 2nd Sun May, Father's Day = 3rd Sun June, DST begins = 2nd Sun Mar, DST ends = 1st Sun Nov | None |
| Christian | `dateutil.easter()` derives Good Friday, Palm Sunday, Ash Wednesday, Ascension, Pentecost; fixed Christmas/Epiphany | None |
| Hindu / yoga festivals | Curated authoritative multi-year table (panchang source) | Extend table ~once a decade |
| Ananda / SRF lineage | Fixed Western-calendar dates, recomputed per year | None |

**Why a table only for Hindu festivals:** Diwali, Maha Shivaratri, Holi, etc.
follow an astronomical lunisolar calendar that no simple formula reproduces
reliably. A curated table (e.g. 2024–2040) from an authoritative panchang is more
trustworthy than an approximation, and only these handful of dates need periodic
refreshing — everything else is computed and maintenance-free.

## Architecture

### Backend

- **Provider registry** (`backend/tasks/holidays_feed.py` or a small new module):
  each holiday set is a key + an `occurrences(year) -> [(date, title)]` function.
  - Set keys: `us_federal`, `us_observances`, `christian`, `hindu_festivals`,
    `ananda_lineage`, plus extensible country packs `country:US`, `country:IT`, …
- **Org setting:** `Organization.enabled_holiday_sets` (JSON list of keys),
  admin-editable. Default for the Ananda org:
  `["us_federal", "us_observances", "christian", "hindu_festivals", "ananda_lineage"]`.
- **Endpoint:** `GET /api/holidays/range?from=&to=` — reads the active org's
  enabled sets, computes occurrences intersecting the window, returns spans
  shaped like the existing `EventSpan` plus `holiday: true` and a `set` key:
  ```json
  { "title": "Diwali", "set": "hindu_festivals", "holiday": true,
    "start": "2026-11-08", "end": "2026-11-08" }
  ```
  Kept **separate** from `/api/events/range` so caching differs and the org's own
  events stay clean.
- **Caching:** results per `(year, set)` are deterministic → cached (Django cache
  / in-memory), so a window only computes each year-set once.

### Frontend

- `useCalendarRange` (in `calendar.ts`) also fetches `/api/holidays/range` in
  parallel and merges holidays into the per-day mapping that Weekly/Monthly
  already build.
- **Rendering:** holidays use the existing `.mev` (month) / `.ev` (week)
  day-notice structure but with a `holiday` modifier class — **muted tone, no
  icon, name only** — so they read as quiet background context, distinct from
  task bars and user events.
- **Admin UI:** a "Holidays" section in `TeamAdmin.tsx` (admins only): a checkbox
  per set + an "Add country" picker (extensibility). Non-admins just see results.

### The "multiple things on one day" fix

Today the **Weekly view shows only the first event per day** (`eventsByDay[idx][0]`)
and silently hides the rest — a latent bug. With holidays added this must be
fixed in both views:

- **Month cell & Week header:** stack up to ~2–3 items, then a **"+N more"** chip.
- Clicking the day opens the **existing day modal**, which lists everything in
  full (tasks + user events + holidays).
- **Sort order within a day:** user events first (actionable), holidays last
  (context).

## Final holiday content (from the Ananda calendar — confirmed)

### `ananda_lineage` — fixed Western-calendar dates, recur yearly

| Date  | Title |
|-------|-------|
| Jan 5  | Yogananda's Birthday |
| Mar 7  | Yogananda's Mahasamadhi |
| Mar 9  | Sri Yukteswar's Mahasamadhi |
| Apr 21 | Swami Kriyananda's Mahasamadhi |
| May 10 | Sri Yukteswar's Birthday |
| May 19 | Swami Kriyananda's Birthday |
| Jul 4  | Founding of Ananda Village |
| Sep 12 | Swami's Discipleship Anniversary |
| Sep 26 | Lahiri Mahasaya's Mahasamadhi |
| Sep 30 | Lahiri Mahasaya's Birthday |

(Jul 4 deliberately coincides with Independence Day — both show, no dedupe.)

### `hindu_festivals` — lunar, curated multi-year table

Diwali, Maha Shivaratri, Holi, **Janmashtami (Babaji Commemoration Day)**,
Navaratri/Dussehra, Ram Navami, Guru Purnima.

> **Babaji:** resolved. Ananda's "Babaji Commemoration Day" is observed on
> **Janmashtami** (a lunar date — Sep 4 in 2026), so it lives in this set,
> labeled accordingly, and stays accurate automatically. No fixed-date Babaji
> entry.

### `us_federal` — Python `holidays` library

New Year's, MLK, Presidents', Memorial, Juneteenth, Independence, Labor,
Columbus/Indigenous Peoples', Veterans, Thanksgiving, Christmas.

### `us_observances` — weekday rules

Mother's Day (2nd Sun May), Father's Day (3rd Sun June), Daylight Saving begins
(2nd Sun Mar), Daylight Saving ends (1st Sun Nov).

### `christian`

Easter, Good Friday, Palm Sunday, Ash Wednesday (+ Christmas, also federal).

### Explicitly NOT in the auto-feed (per user)

Year-specific / scheduled Ananda items — **Inner Renewal Retreat**, **Swami's
Centennial**, **Eight-Hour Meditation** — are added each year through the
existing admin event tool, since their real dates drift or are one-time. They
are normal `CalendarEvent`s, not computed holidays.

## Testing (per workspace Rule #7)

- **Backend unit tests** asserting known dates: Thanksgiving 2026 = Nov 26;
  MLK/Juneteenth observed-date logic; Easter 2027 = Mar 28; Good Friday derived;
  Yogananda mahasamadhi = Mar 7 each year; Feb-29 date skipped in non-leap year;
  Diwali table spot-checks; window crossing a year boundary returns both years.
- **Endpoint tests:** only enabled sets returned; admin can change the org
  setting, non-admin cannot; unauthenticated rejected.
- **Frontend:** `calendar.test.ts` — merge logic and "+N more" overflow.
- **Browser QA (Rule #8):** Playwright pass on Weekly + Monthly, light & dark,
  admin vs non-admin, a day with many stacked items.

## Edge cases handled

- 6-week month grids crossing a year boundary → provider iterates each year.
- Feb 29 holiday/lineage dates → skipped in non-leap years (matches current
  yearly-event behavior).
- No timezone math — plain `YYYY-MM-DD`.
- Holiday and a user event with the same name/day → both shown (no dedupe).

## Dependencies

- Add `holidays` (Python) to `backend/requirements.txt`.
- `python-dateutil` already present (Easter math).
- No new frontend dependencies.
