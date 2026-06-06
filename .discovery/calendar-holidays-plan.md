# Calendar Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-display holidays (US Federal, US civil observances, Christian, Hindu/yoga festivals, Ananda lineage) in the Weekly & Monthly calendars, admin-toggleable per org and accurate every year without manual upkeep for the computable sets.

**Architecture:** A backend "holiday feed" computes each enabled set per year (library/algorithm for deterministic sets, a curated table for lunar Hindu festivals) and serves spans via a new `/api/holidays/range` endpoint, shaped like the existing event spans. The active org's `enabled_holiday_sets` (a JSON field, admin-edited through a new TeamAdmin tab) decides which sets apply. The frontend merges holidays into the existing per-day calendar rendering as muted, icon-less chips, and gains a "+N more" overflow affordance that also fixes a latent week-view bug.

**Tech Stack:** Django + DRF, `holidays` (new) + `python-dateutil` (present); React + Vite + TypeScript; pytest / vitest; Playwright MCP for browser QA.

**Source of truth for dates:** `design/Ananda Holidays.jpeg` (ananda.org/thank-you-god) and the design spec `.discovery/calendar-holidays-design.md`.

---

## File Structure

**Backend (create):**
- `backend/tasks/holidays_feed.py` — provider registry + `holidays_in_range()` aggregator. One responsibility: turn (enabled sets, date window) into holiday spans.
- `backend/tasks/test_holidays_feed.py` — unit tests for every provider + aggregator.
- `backend/tasks/test_holidays_api.py` — endpoint + settings endpoint tests.

**Backend (modify):**
- `backend/requirements.txt` — add `holidays`.
- `backend/accounts/models.py` — add `Organization.enabled_holiday_sets`.
- `backend/accounts/migrations/0009_org_holiday_sets.py` — new migration (number may differ; use the next free one).
- `backend/tasks/events_views.py` — add `HolidaysRangeView` + `HolidaySettingsView` (reuses `_parse`).
- `backend/tasks/urls.py` — route `holidays/range` and `holidays/settings`.

**Frontend (modify):**
- `frontend/src/types.ts` — add `Holiday` interface.
- `frontend/src/calendar.ts` — fetch holidays in `useCalendarRange`; add a `dayCells()` helper for merge + overflow.
- `frontend/src/components/MonthlyView.tsx` — render holidays + "+N more"; include holidays in the day modal.
- `frontend/src/components/WeeklyView.tsx` — render stacked items + "+N more" (fixes show-only-first bug); include holidays in the day modal.
- `frontend/src/components/TeamAdmin.tsx` — new "Holidays" tab.
- `frontend/src/App.css` — `.holiday` chip + `.more` styles.
- `frontend/src/calendar.test.ts` — tests for `dayCells()`.
- `frontend/src/locales/en.json` — new i18n keys (other locales: English fallback is acceptable for this pass).

---

## Task 1: Add the `holidays` dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the dependency**

Add this line under `python-dateutil>=2.9`:

```
holidays>=0.50
```

- [ ] **Step 2: Install**

Run: `pip install -r backend/requirements.txt`
Expected: `holidays` installs successfully.

- [ ] **Step 3: Verify it computes a known US federal date**

Run: `python -c "import holidays; print('2026-11-26' in {d.isoformat() for d in holidays.country_holidays('US', years=2026)})"`
Expected: `True` (Thanksgiving 2026).

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "build: add holidays library for calendar holiday feed"
```

---

## Task 2: Add `enabled_holiday_sets` to Organization

**Files:**
- Modify: `backend/accounts/models.py:83-98` (the `Organization` class)
- Create: `backend/accounts/migrations/0009_org_holiday_sets.py` (use the next free migration number)

- [ ] **Step 1: Add the field**

In `backend/accounts/models.py`, inside `class Organization`, after the `created_at` line, add:

```python
    # Holiday sets shown on this org's calendars (keys from tasks.holidays_feed).
    # Empty list → the app falls back to DEFAULT_SETS at read time.
    enabled_holiday_sets = models.JSONField(default=list, blank=True)
```

- [ ] **Step 2: Make the migration**

Run: `python backend/manage.py makemigrations accounts`
Expected: creates `0009_org_holiday_sets.py` (or next number) adding the JSON field.

- [ ] **Step 3: Apply it**

Run: `python backend/manage.py migrate accounts`
Expected: migration applies with no error.

- [ ] **Step 4: Commit**

```bash
git add backend/accounts/models.py backend/accounts/migrations/
git commit -m "feat(holidays): add Organization.enabled_holiday_sets"
```

---

## Task 3: Ananda lineage provider (fixed dates)

**Files:**
- Create: `backend/tasks/holidays_feed.py`
- Create: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tasks/test_holidays_feed.py`:

```python
from datetime import date
from tasks.holidays_feed import ananda_lineage


def test_lineage_has_ten_fixed_days():
    days = ananda_lineage(2026)
    assert len(days) == 10


def test_lineage_yogananda_mahasamadhi_is_march_7():
    days = dict((title, d) for d, title in ananda_lineage(2030))
    assert days["Yogananda's Mahasamadhi"] == date(2030, 3, 7)


def test_lineage_founding_of_ananda_village_july_4():
    days = dict((title, d) for d, title in ananda_lineage(2027))
    assert days["Founding of Ananda Village"] == date(2027, 7, 4)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'tasks.holidays_feed'`.

- [ ] **Step 3: Create the module with the lineage provider**

Create `backend/tasks/holidays_feed.py`:

```python
"""Computed holiday feed.

Each holiday SET is a key mapped to a provider `occurrences(year) -> [(date, title)]`.
The active org's enabled set keys are merged over a date window into span dicts.
Deterministic sets are computed (library / algorithm); the lunar Hindu festivals
are table-driven. Results per (set, year) are deterministic and cached.
"""

from datetime import date

# ---- Ananda / SRF lineage: fixed Western-calendar dates --------------------
# (month, day) -> title. Source: ananda.org/thank-you-god (design/Ananda Holidays.jpeg).
_LINEAGE = [
    ((1, 5),  "Yogananda's Birthday"),
    ((3, 7),  "Yogananda's Mahasamadhi"),
    ((3, 9),  "Sri Yukteswar's Mahasamadhi"),
    ((4, 21), "Swami Kriyananda's Mahasamadhi"),
    ((5, 10), "Sri Yukteswar's Birthday"),
    ((5, 19), "Swami Kriyananda's Birthday"),
    ((7, 4),  "Founding of Ananda Village"),
    ((9, 12), "Swami's Discipleship Anniversary"),
    ((9, 26), "Lahiri Mahasaya's Mahasamadhi"),
    ((9, 30), "Lahiri Mahasaya's Birthday"),
]


def ananda_lineage(year):
    return [(date(year, m, d), title) for (m, d), title in _LINEAGE]
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): Ananda lineage provider"
```

---

## Task 4: US civil observances provider (weekday rules)

**Files:**
- Modify: `backend/tasks/holidays_feed.py`
- Modify: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_feed.py`:

```python
from tasks.holidays_feed import us_observances


def test_mothers_day_2026_is_may_10():
    days = dict((title, d) for d, title in us_observances(2026))
    assert days["Mother's Day"] == date(2026, 5, 10)


def test_fathers_day_2026_is_june_21():
    days = dict((title, d) for d, title in us_observances(2026))
    assert days["Father's Day"] == date(2026, 6, 21)


def test_dst_2026_begins_mar_8_ends_nov_1():
    days = dict((title, d) for d, title in us_observances(2026))
    assert days["Daylight Saving begins"] == date(2026, 3, 8)
    assert days["Daylight Saving ends"] == date(2026, 11, 1)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k observances -v`
Expected: FAIL — `cannot import name 'us_observances'`.

- [ ] **Step 3: Implement**

Append to `backend/tasks/holidays_feed.py`:

```python
# ---- US civil observances: nth-weekday rules -------------------------------
_SUN = 6  # Mon=0 .. Sun=6


def _nth_weekday(year, month, weekday, n):
    """The nth (1-based) `weekday` of `month`."""
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return date(year, month, 1 + offset + (n - 1) * 7)


def us_observances(year):
    return [
        (_nth_weekday(year, 5, _SUN, 2),  "Mother's Day"),
        (_nth_weekday(year, 6, _SUN, 3),  "Father's Day"),
        (_nth_weekday(year, 3, _SUN, 2),  "Daylight Saving begins"),
        (_nth_weekday(year, 11, _SUN, 1), "Daylight Saving ends"),
    ]
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k observances -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): US civil observances provider"
```

---

## Task 5: Christian provider (Easter-derived + fixed)

**Files:**
- Modify: `backend/tasks/holidays_feed.py`
- Modify: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_feed.py`:

```python
from tasks.holidays_feed import christian


def test_easter_2027_is_march_28():
    days = dict((title, d) for d, title in christian(2027))
    assert days["Easter"] == date(2027, 3, 28)


def test_good_friday_is_two_days_before_easter():
    days = dict((title, d) for d, title in christian(2026))
    assert days["Easter"] == date(2026, 4, 5)
    assert days["Good Friday"] == date(2026, 4, 3)


def test_christmas_is_fixed():
    days = dict((title, d) for d, title in christian(2030))
    assert days["Christmas Day"] == date(2030, 12, 25)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k christian -v`
Expected: FAIL — `cannot import name 'christian'`.

- [ ] **Step 3: Implement**

Add to the imports at the top of `backend/tasks/holidays_feed.py`:

```python
from datetime import timedelta

from dateutil.easter import easter
```

Append the provider:

```python
# ---- Christian: Easter-derived moveable feasts + fixed ----------------------
def christian(year):
    e = easter(year)  # Gregorian Easter Sunday
    return [
        (e - timedelta(days=46), "Ash Wednesday"),
        (e - timedelta(days=7),  "Palm Sunday"),
        (e - timedelta(days=2),  "Good Friday"),
        (e,                      "Easter"),
        (date(year, 1, 6),       "Epiphany"),
        (date(year, 12, 25),     "Christmas Day"),
    ]
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k christian -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): Christian provider (Easter-derived)"
```

---

## Task 6: US Federal + country-pack provider (`holidays` library)

**Files:**
- Modify: `backend/tasks/holidays_feed.py`
- Modify: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_feed.py`:

```python
from tasks.holidays_feed import country_pack, us_federal


def test_us_federal_includes_thanksgiving_2026():
    days = {d for d, _ in us_federal(2026)}
    assert date(2026, 11, 26) in days


def test_us_federal_includes_juneteenth():
    titles = " ".join(t for _, t in us_federal(2026))
    assert "Juneteenth" in titles


def test_country_pack_italy_has_republic_day_june_2():
    days = {d for d, _ in country_pack("IT")(2026)}
    assert date(2026, 6, 2) in days  # Festa della Repubblica
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k "federal or country" -v`
Expected: FAIL — `cannot import name 'country_pack'`.

- [ ] **Step 3: Implement**

Add to the imports at the top of `backend/tasks/holidays_feed.py`:

```python
import holidays as pyholidays
```

Append:

```python
# ---- Country packs via the `holidays` library (extensible) -----------------
def country_pack(code):
    """A provider for one ISO country code (e.g. 'US', 'IT'). The library
    handles observed-date shifts automatically."""
    def provider(year):
        items = pyholidays.country_holidays(code, years=year)
        return sorted(items.items())  # [(date, name), ...]
    return provider


us_federal = country_pack("US")
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k "federal or country" -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): US federal + extensible country packs"
```

---

## Task 7: Hindu / yoga festivals provider (curated table)

> **Accuracy note (read first):** Diwali, Maha Shivaratri, Holi, Janmashtami,
> Navaratri/Dussehra, Ram Navami and Guru Purnima follow an astronomical
> lunisolar calendar that no simple formula reproduces reliably, so this set is
> a **curated table**. Populate it from an authoritative panchang
> (drikpanchang.com, US/Pacific observance) for years **2025–2040**. Each year's
> Janmashtami carries the label **"Janmashtami (Babaji Commemoration Day)"** per
> the Ananda calendar. The 2026 anchor is verified from
> `design/Ananda Holidays.jpeg`: Janmashtami = **Sept 4, 2026**. This is data
> entry, not logic — the test below pins the format and the verified anchor;
> extend the dict the same way for every year, spot-checking 2–3 dates per year
> against the source.

**Files:**
- Modify: `backend/tasks/holidays_feed.py`
- Modify: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_feed.py`:

```python
from tasks.holidays_feed import hindu_festivals


def test_janmashtami_2026_is_sept_4_and_labels_babaji():
    days = dict((title, d) for d, title in hindu_festivals(2026))
    assert days["Janmashtami (Babaji Commemoration Day)"] == date(2026, 9, 4)


def test_hindu_unknown_year_returns_empty_not_error():
    assert hindu_festivals(1900) == []


def test_hindu_festivals_have_titles_and_dates():
    for d, title in hindu_festivals(2026):
        assert isinstance(d, date) and isinstance(title, str) and title
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k hindu -v`
Expected: FAIL — `cannot import name 'hindu_festivals'`.

- [ ] **Step 3: Implement (with the 2026 row filled, then extend per the accuracy note)**

Append to `backend/tasks/holidays_feed.py`:

```python
# ---- Hindu / yoga festivals: curated lunisolar table -----------------------
# (month, day) -> title, per year. Source: drikpanchang.com (US observance).
# EXTEND 2025, 2027..2040 the same way; spot-check 2-3 dates/year vs source.
_JANMASHTAMI = "Janmashtami (Babaji Commemoration Day)"
_HINDU = {
    2026: [
        ((2, 15), "Maha Shivaratri"),
        ((3, 4),  "Holi"),
        ((3, 27), "Ram Navami"),
        ((7, 29), "Guru Purnima"),
        ((9, 4),  _JANMASHTAMI),
        ((10, 11), "Navaratri begins"),
        ((10, 20), "Dussehra"),
        ((11, 8), "Diwali"),
    ],
    # 2025: [ ... ],  2027: [ ... ],  ... through 2040
}


def hindu_festivals(year):
    return [(date(year, m, d), title) for (m, d), title in _HINDU.get(year, [])]
```

> When extending: every `((month, day), title)` must come from the panchang
> source for that exact year. Do NOT copy a prior year's dates forward — they
> move. After filling each year, add a one-line spot-check assertion to the test
> (e.g. Diwali 2027) so regressions surface.

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k hindu -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): Hindu/yoga festivals curated table (2026 anchor)"
```

---

## Task 8: Registry + `holidays_in_range()` aggregator

**Files:**
- Modify: `backend/tasks/holidays_feed.py`
- Modify: `backend/tasks/test_holidays_feed.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_feed.py`:

```python
from tasks.holidays_feed import (
    AVAILABLE_SETS, DEFAULT_SETS, holidays_in_range, provider_for,
)


def test_default_sets_are_the_five_ananda_sets():
    assert DEFAULT_SETS == [
        "us_federal", "us_observances", "christian",
        "hindu_festivals", "ananda_lineage",
    ]


def test_range_filters_to_window_and_tags_set():
    out = holidays_in_range(("ananda_lineage",), date(2026, 3, 1), date(2026, 3, 31))
    titles = {h["title"] for h in out}
    assert "Yogananda's Mahasamadhi" in titles          # Mar 7 in window
    assert "Yogananda's Birthday" not in titles          # Jan 5 outside window
    assert all(h["set"] == "ananda_lineage" and h["holiday"] is True for h in out)
    assert all(h["start"] == h["end"] for h in out)


def test_range_spans_year_boundary():
    out = holidays_in_range(("ananda_lineage",), date(2025, 12, 28), date(2026, 1, 6))
    titles = {h["title"] for h in out}
    assert "Yogananda's Birthday" in titles               # Jan 5 2026


def test_range_is_sorted_by_date_then_title():
    out = holidays_in_range(tuple(DEFAULT_SETS), date(2026, 1, 1), date(2026, 12, 31))
    keys = [(h["start"], h["title"]) for h in out]
    assert keys == sorted(keys)


def test_country_pack_key_routes_via_provider_for():
    assert provider_for("country:IT") is not None
    assert provider_for("nonsense") is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -k "range or default or provider_for or country_pack_key" -v`
Expected: FAIL — `cannot import name 'holidays_in_range'`.

- [ ] **Step 3: Implement**

Add to the imports at the top of `backend/tasks/holidays_feed.py`:

```python
from functools import lru_cache
```

Append:

```python
# ---- Registry + aggregator -------------------------------------------------
SET_PROVIDERS = {
    "us_federal": us_federal,
    "us_observances": us_observances,
    "christian": christian,
    "hindu_festivals": hindu_festivals,
    "ananda_lineage": ananda_lineage,
}

# Order chosen for the admin UI and as the default for orgs with none set.
DEFAULT_SETS = [
    "us_federal", "us_observances", "christian",
    "hindu_festivals", "ananda_lineage",
]
AVAILABLE_SETS = list(SET_PROVIDERS.keys())


def provider_for(key):
    """Resolve a set key to its provider, including `country:XX` packs."""
    if key in SET_PROVIDERS:
        return SET_PROVIDERS[key]
    if key.startswith("country:"):
        return country_pack(key.split(":", 1)[1])
    return None


@lru_cache(maxsize=1024)
def _set_year(key, year):
    """Cached (key, year) -> tuple of (iso_date, title, key). Deterministic."""
    prov = provider_for(key)
    if prov is None:
        return ()
    return tuple((d.isoformat(), title, key) for d, title in prov(year))


def holidays_in_range(enabled_sets, start, end):
    """Span dicts for every enabled set occurrence within [start, end] inclusive.

    `enabled_sets` is an iterable of set keys; start/end are `date`s. Spans match
    the existing EventSpan shape plus `set` and `holiday: True`.
    """
    lo, hi = start.isoformat(), end.isoformat()
    out = []
    for key in enabled_sets:
        for year in range(start.year, end.year + 1):
            for iso, title, set_key in _set_year(key, year):
                if lo <= iso <= hi:
                    out.append({
                        "title": title, "set": set_key, "holiday": True,
                        "start": iso, "end": iso,
                    })
    out.sort(key=lambda h: (h["start"], h["title"]))
    return out
```

- [ ] **Step 4: Run to verify the full module suite passes**

Run: `python -m pytest backend/tasks/test_holidays_feed.py -v`
Expected: PASS (all tests across Tasks 3–8).

- [ ] **Step 5: Commit**

```bash
git add backend/tasks/holidays_feed.py backend/tasks/test_holidays_feed.py
git commit -m "feat(holidays): set registry + range aggregator with caching"
```

---

## Task 9: `/api/holidays/range` endpoint

**Files:**
- Modify: `backend/tasks/events_views.py`
- Modify: `backend/tasks/urls.py:20`
- Create: `backend/tasks/test_holidays_api.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tasks/test_holidays_api.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import Membership, Organization

User = get_user_model()


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda", is_active=True)


@pytest.fixture
def member(db, org):
    u = User.objects.create_user(username="m@x.com", email="m@x.com", password="pw")
    Membership.objects.create(user=u, organization=org, role="member", is_active=True)
    return u


def _auth(client, user, org):
    client.force_authenticate(user=user)
    return {"HTTP_X_ORG_ID": str(org.id)}


def test_range_returns_holidays_in_window(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=2026-03-01&to=2026-03-31", **hdrs)
    assert r.status_code == 200
    titles = {h["title"] for h in r.json()}
    assert "Yogananda's Mahasamadhi" in titles
    assert all(h["holiday"] for h in r.json())


def test_range_respects_enabled_sets(member, org):
    org.enabled_holiday_sets = ["ananda_lineage"]
    org.save()
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=2026-01-01&to=2026-12-31", **hdrs)
    assert {h["set"] for h in r.json()} == {"ananda_lineage"}


def test_range_requires_auth():
    c = APIClient()
    r = c.get("/api/holidays/range?from=2026-01-01&to=2026-01-31")
    assert r.status_code in (401, 403)


def test_range_bad_date_is_400(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/range?from=nope&to=2026-01-31", **hdrs)
    assert r.status_code == 400
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_api.py -k range -v`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Implement the view**

In `backend/tasks/events_views.py`, add to the imports:

```python
from .holidays_feed import AVAILABLE_SETS, DEFAULT_SETS, holidays_in_range
from permissions.drf import IsAdminOrReadOnly  # if not already imported
```

(`IsAdminOrReadOnly` is already imported at line 14 — don't duplicate it.) Append at the end of the file:

```python
class HolidaysRangeView(APIView):
    """Computed holiday spans for the active org, intersecting [from, to]."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = _parse(request.query_params.get("from"), "from")
        end = _parse(request.query_params.get("to"), "to")
        org = _org(request)
        sets = org.enabled_holiday_sets if (org and org.enabled_holiday_sets) else DEFAULT_SETS
        return Response(holidays_in_range(tuple(sets), start, end))
```

- [ ] **Step 4: Add the route**

In `backend/tasks/urls.py`, add the import to the `events_views` line:

```python
from .events_views import (
    CalendarEventViewSet, EventsRangeView, HolidaysRangeView, StatusViewSet,
)
```

And add this to `urlpatterns`, right after the `events/range` line (line 20):

```python
    path("holidays/range", HolidaysRangeView.as_view(), name="holidays-range"),
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_api.py -k range -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/tasks/events_views.py backend/tasks/urls.py backend/tasks/test_holidays_api.py
git commit -m "feat(holidays): /api/holidays/range endpoint"
```

---

## Task 10: `/api/holidays/settings` endpoint (admin read/write)

**Files:**
- Modify: `backend/tasks/events_views.py`
- Modify: `backend/tasks/urls.py`
- Modify: `backend/tasks/test_holidays_api.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tasks/test_holidays_api.py`:

```python
@pytest.fixture
def admin(db, org):
    u = User.objects.create_user(username="a@x.com", email="a@x.com", password="pw")
    Membership.objects.create(user=u, organization=org, role="admin", is_active=True)
    return u


def test_settings_get_returns_enabled_and_available(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.get("/api/holidays/settings", **hdrs)
    assert r.status_code == 200
    body = r.json()
    assert "ananda_lineage" in body["available"]
    assert isinstance(body["enabled"], list)


def test_settings_patch_requires_admin(member, org):
    c = APIClient()
    hdrs = _auth(c, member, org)
    r = c.patch("/api/holidays/settings", {"enabled": ["us_federal"]}, format="json", **hdrs)
    assert r.status_code == 403


def test_settings_patch_admin_saves(admin, org):
    c = APIClient()
    hdrs = _auth(c, admin, org)
    r = c.patch("/api/holidays/settings",
                {"enabled": ["us_federal", "country:IT"]}, format="json", **hdrs)
    assert r.status_code == 200
    org.refresh_from_db()
    assert org.enabled_holiday_sets == ["us_federal", "country:IT"]


def test_settings_patch_rejects_unknown_set(admin, org):
    c = APIClient()
    hdrs = _auth(c, admin, org)
    r = c.patch("/api/holidays/settings", {"enabled": ["bogus"]}, format="json", **hdrs)
    assert r.status_code == 400
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest backend/tasks/test_holidays_api.py -k settings -v`
Expected: FAIL — 404.

- [ ] **Step 3: Implement the view**

Append to `backend/tasks/events_views.py`:

```python
class HolidaySettingsView(APIView):
    """GET the active org's enabled holiday sets (+ the full available list);
    PATCH to change them (admins only). Country packs use `country:XX` keys."""

    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        org = _org(request)
        enabled = org.enabled_holiday_sets if (org and org.enabled_holiday_sets) else DEFAULT_SETS
        return Response({"enabled": enabled, "available": AVAILABLE_SETS})

    def patch(self, request):
        org = _org(request)
        if org is None:
            raise ValidationError("No active organization.")
        sets = request.data.get("enabled")
        if not isinstance(sets, list) or any(not isinstance(s, str) for s in sets):
            raise ValidationError({"enabled": "Expected a list of set keys."})
        allowed = set(AVAILABLE_SETS)
        bad = [s for s in sets if s not in allowed and not s.startswith("country:")]
        if bad:
            raise ValidationError({"enabled": f"Unknown sets: {bad}"})
        org.enabled_holiday_sets = sets
        org.save(update_fields=["enabled_holiday_sets"])
        return Response({"enabled": sets, "available": AVAILABLE_SETS})
```

- [ ] **Step 4: Add the route**

In `backend/tasks/urls.py`, extend the `events_views` import with `HolidaySettingsView`, and add after the `holidays/range` line:

```python
    path("holidays/settings", HolidaySettingsView.as_view(), name="holidays-settings"),
```

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest backend/tasks/test_holidays_api.py -v`
Expected: PASS (all range + settings tests).

- [ ] **Step 6: Commit**

```bash
git add backend/tasks/events_views.py backend/tasks/urls.py backend/tasks/test_holidays_api.py
git commit -m "feat(holidays): admin-editable /api/holidays/settings"
```

---

## Task 11: Frontend `Holiday` type + fetch in `useCalendarRange`

**Files:**
- Modify: `frontend/src/types.ts:158-165`
- Modify: `frontend/src/calendar.ts:33-51`

- [ ] **Step 1: Add the type**

In `frontend/src/types.ts`, after the `EventSpan` interface (line 165), add:

```typescript
export interface Holiday {
  title: string;
  set: string;
  holiday: true;
  start: string; // YYYY-MM-DD
  end: string;   // == start (holidays are single-day)
}
```

- [ ] **Step 2: Fetch holidays in the range hook**

In `frontend/src/calendar.ts`, update the import on line 3 to add `Holiday`:

```typescript
import type { CalendarInstance, EventSpan, Holiday, Me, Task } from "./types";
```

Then in `useCalendarRange`, add a holidays state and fetch, and return it. Replace the body (lines 40-50) with:

```typescript
  const [items, setItems] = useState<CalendarInstance[] | null>(null);
  const [events, setEvents] = useState<EventSpan[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  useEffect(() => {
    const p = new URLSearchParams({ from, to });
    if (subprojectId) p.set("subproject", String(subprojectId));
    else if (projectId) p.set("project", String(projectId));
    setItems(null);
    api.get(`/api/calendar?${p}`).then(setItems).catch(() => setItems([]));
    api.get(`/api/events/range?from=${from}&to=${to}`).then(setEvents).catch(() => setEvents([]));
    api.get(`/api/holidays/range?from=${from}&to=${to}`).then(setHolidays).catch(() => setHolidays([]));
  }, [from, to, projectId, subprojectId, refreshKey]);
  return { items, events, holidays };
```

- [ ] **Step 3: Verify the frontend still builds**

Run: `cd frontend && npm run build`
Expected: build succeeds (holidays not yet consumed — that's fine).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/calendar.ts
git commit -m "feat(holidays): fetch holiday spans in useCalendarRange"
```

---

## Task 12: `dayCells()` merge + overflow helper (+ unit tests)

**Files:**
- Modify: `frontend/src/calendar.ts`
- Modify: `frontend/src/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/calendar.test.ts`:

```typescript
import { dayCells } from "./calendar";
import type { EventSpan, Holiday } from "./types";

const ev = (title: string): EventSpan =>
  ({ id: 1, title, kind: "single", yearly: false, start: "2026-01-01", end: "2026-01-01" });
const hol = (title: string): Holiday =>
  ({ title, set: "ananda_lineage", holiday: true, start: "2026-01-01", end: "2026-01-01" });

test("events sort before holidays", () => {
  const { visible } = dayCells([ev("Retreat")], [hol("Yogananda's Birthday")], 5);
  expect(visible[0].label).toBe("Retreat");
  expect(visible[0].holiday).toBe(false);
  expect(visible[1].holiday).toBe(true);
});

test("caps to max and reports overflow count", () => {
  const events = [ev("A"), ev("B"), ev("C")];
  const holidays = [hol("D"), hol("E")];
  const { visible, more } = dayCells(events, holidays, 3);
  expect(visible).toHaveLength(3);
  expect(more).toBe(2);
});

test("no overflow when within cap", () => {
  const { more } = dayCells([ev("A")], [hol("B")], 3);
  expect(more).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/calendar.test.ts`
Expected: FAIL — `dayCells` is not exported.

- [ ] **Step 3: Implement**

Add to the top imports of `frontend/src/calendar.ts` (extend the existing type import):

```typescript
import type { CalendarInstance, EventSpan, Holiday, Me, Task } from "./types";
```

Append to `frontend/src/calendar.ts`:

```typescript
// One renderable line in a day cell: a user event or a holiday. Events sort
// first (actionable); holidays last (context). `more` is how many were clipped.
export interface DayCell { label: string; holiday: boolean; set?: string }

export function dayCells(
  events: { title: string }[],
  holidays: { title: string; set: string }[],
  max: number,
): { visible: DayCell[]; more: number } {
  const all: DayCell[] = [
    ...events.map((e) => ({ label: e.title, holiday: false })),
    ...holidays.map((h) => ({ label: h.title, holiday: true, set: h.set })),
  ];
  return { visible: all.slice(0, max), more: Math.max(0, all.length - max) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/calendar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/calendar.ts frontend/src/calendar.test.ts
git commit -m "feat(holidays): dayCells merge + overflow helper"
```

---

## Task 13: Render holidays + "+N more" in MonthlyView

**Files:**
- Modify: `frontend/src/components/MonthlyView.tsx`

- [ ] **Step 1: Build the holidays-by-date map and consume the hook value**

In `frontend/src/components/MonthlyView.tsx`, update the hook destructure (line 24):

```typescript
  const { items, events, holidays } = useCalendarRange(from, to, projectId, subprojectId, refreshKey);
```

Update the imports: add `dayCells` to the calendar import (line 7) and `Holiday` to the types import (line 10):

```typescript
import { dayCells, useCalendarRange, type CalendarViewProps } from "../calendar";
```
```typescript
import { EVENT_ICON, type CalendarInstance, type EventSpan, type Holiday, type Task } from "../types";
```

After the `eventsByDate` memo (line 38), add a holidays map:

```typescript
  const holidaysByDate = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) {
      if (!m.has(h.start)) m.set(h.start, []);
      m.get(h.start)!.push(h);
    }
    return m;
  }, [holidays]);
```

- [ ] **Step 2: Render merged cells with overflow**

In the day-cell render, replace the events block (lines 110-112) with a merged block. Replace:

```typescript
                  {dayEvents.map((e, k) => (
                    <div key={`ev-${k}`} className="mev" title={e.title}>{EVENT_ICON[e.kind]} {e.title}</div>
                  ))}
```

with:

```typescript
                  {(() => {
                    const dayHols = holidaysByDate.get(iso) ?? [];
                    const { visible, more } = dayCells(dayEvents, dayHols, 3);
                    return (<>
                      {visible.map((c, k) => (
                        <div key={`c${k}`} className={`mev${c.holiday ? " holiday" : ""}`} title={c.label}>
                          {c.holiday ? c.label : `${EVENT_ICON[(dayEvents[k] as EventSpan).kind]} ${c.label}`}
                        </div>
                      ))}
                      {more > 0 && <div className="more">+{more} {t("cal.more", "more")}</div>}
                    </>);
                  })()}
```

> Note: holidays render as plain text (no icon) with the `.holiday` modifier;
> events keep their `EVENT_ICON`. Because events sort first in `dayCells`,
> `dayEvents[k]` aligns with the first events in `visible`.

- [ ] **Step 3: Open the day on a holiday-only day, and list holidays in the modal**

Update the cell `onClick` (line 103) to also open when only holidays exist:

```typescript
                  onClick={() => (dayItems.length || dayEvents.length || (holidaysByDate.get(iso)?.length)) && setDayOpen(iso)}>
```

In the day modal (after line 129, before `<DayTaskList`), add the holiday list:

```typescript
              {(holidaysByDate.get(dayOpen) ?? []).map((h, k) => (
                <div key={`h${k}`} className="cal-event holiday" style={{ margin: "0 0 8px" }}>{h.title}</div>
              ))}
```

- [ ] **Step 4: Verify build + manual smoke**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MonthlyView.tsx
git commit -m "feat(holidays): render holidays + overflow in MonthlyView"
```

---

## Task 14: Render stacked items + "+N more" in WeeklyView (fixes show-only-first bug)

**Files:**
- Modify: `frontend/src/components/WeeklyView.tsx`

- [ ] **Step 1: Consume holidays and build per-day cells**

In `frontend/src/components/WeeklyView.tsx`, update the hook destructure (line 40):

```typescript
  const { items, events, holidays } = useCalendarRange(dayIso[0], dayIso[6], projectId, subprojectId, refreshKey);
```

Update imports: add `dayCells` (line 7) and `Holiday` (line 12):

```typescript
import { dayCells, packLanes, useCalendarRange, type CalendarViewProps } from "../calendar";
```
```typescript
import { EVENT_ICON, type CalendarInstance, type EventSpan, type Holiday, type Task } from "../types";
```

Replace the `eventsByDay` memo (lines 78-81) with a merged per-day cells memo:

```typescript
  // Per-day merged cells: user events first, holidays after, capped with "+N".
  const cellsByDay = useMemo(() => {
    return dayIso.map((iso) => {
      const dayEvents = events.filter((e) => e.start <= iso && e.end >= iso);
      const dayHols = holidays.filter((h) => h.start === iso);
      const withIcons = dayEvents.map((e) => ({ title: `${EVENT_ICON[e.kind]} ${e.title}` }));
      return dayCells(withIcons, dayHols, 2);
    });
  }, [events, holidays, dayIso]);
```

- [ ] **Step 2: Render the stack in the week header**

Replace the single-event line (line 120):

```typescript
                  {eventsByDay[idx].length > 0 && <div className="ev" title={eventsByDay[idx].join(", ")}>{eventsByDay[idx][0]}</div>}
```

with:

```typescript
                  {cellsByDay[idx].visible.map((c, k) => (
                    <div key={`c${k}`} className={`ev${c.holiday ? " holiday" : ""}`} title={c.label}>{c.label}</div>
                  ))}
                  {cellsByDay[idx].more > 0 && <div className="more">+{cellsByDay[idx].more} {t("cal.more", "more")}</div>}
```

- [ ] **Step 3: List holidays in the week day modal**

In the `dayOpen` modal (after line 172's `<Modal ...>` open tag, before `<DayTaskList`), add:

```typescript
          {holidays.filter((h) => h.start === dayOpen).map((h, k) => (
            <div key={`h${k}`} className="cal-event holiday" style={{ margin: "0 0 8px" }}>{h.title}</div>
          ))}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WeeklyView.tsx
git commit -m "feat(holidays): stacked items + overflow in WeeklyView (fix show-only-first)"
```

---

## Task 15: Holiday chip + "+N more" styling

**Files:**
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add styles**

In `frontend/src/App.css`, after the `.mev` rule (line 230), add:

```css
/* Holidays: muted, icon-less, read as background context (not tasks). */
.mev.holiday { color: var(--muted); font-weight: 500; }
.wk-hcell .ev.holiday { color: var(--muted); font-weight: 500; }
.cal-event.holiday { color: var(--muted); font-weight: 500; }
.mcell .more, .wk-hcell .more { font-size: 10px; color: var(--muted); font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.css
git commit -m "style(holidays): muted holiday chips + overflow label"
```

---

## Task 16: Admin "Holidays" tab in TeamAdmin

**Files:**
- Modify: `frontend/src/components/TeamAdmin.tsx`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Add i18n keys**

In `frontend/src/locales/en.json`, add (inside the existing JSON object — match surrounding structure; if a `tabs` / `cal` object exists, add the keys there):

```json
  "tabs.holidays": "Holidays",
  "cal.more": "more",
  "holidays.title": "Holiday sets shown on this organization's calendars",
  "holidays.help": "Members worldwide see only what you enable here.",
  "holidays.set.us_federal": "US Federal holidays",
  "holidays.set.us_observances": "US observances (Mother's/Father's Day, Daylight Saving)",
  "holidays.set.christian": "Christian / religious",
  "holidays.set.hindu_festivals": "Hindu / yoga festivals",
  "holidays.set.ananda_lineage": "Ananda lineage days",
  "holidays.save": "Save",
  "holidays.saved": "Saved"
```

- [ ] **Step 2: Extend the Tab type and tab bar**

In `frontend/src/components/TeamAdmin.tsx`, change the `Tab` type (line 10):

```typescript
type Tab = "members" | "groups" | "access" | "activity" | "holidays";
```

Add to the `labels` map (lines 58-61):

```typescript
    activity: tr("tabs.activity"), holidays: tr("tabs.holidays"),
```

Add `"holidays"` to the tab-button array (line 66):

```typescript
        {(["members", "groups", "access", "activity", "holidays"] as Tab[]).map((t) => (
```

Add the panel after the `activity` panel (line 78):

```typescript
          {tab === "holidays" && <Holidays />}
```

- [ ] **Step 3: Implement the `Holidays` component**

Append to `frontend/src/components/TeamAdmin.tsx`:

```typescript
const HOLIDAY_SET_KEYS = [
  "us_federal", "us_observances", "christian", "hindu_festivals", "ananda_lineage",
] as const;

function Holidays() {
  const { t: tr } = useTranslation();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { guard, busy } = useSubmitGuard();

  useEffect(() => {
    api.get("/api/holidays/settings").then((d: { enabled: string[]; available: string[] }) => {
      setEnabled(d.enabled); setAvailable(d.available); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setSaved(false);
    setEnabled((e) => (e.includes(key) ? e.filter((k) => k !== key) : [...e, key]));
  }

  async function save() {
    await guard(async () => {
      await api.patch("/api/holidays/settings", { enabled });
      setSaved(true);
    });
  }

  if (loading) return <Spinner />;
  const keys = available.filter((k) => HOLIDAY_SET_KEYS.includes(k as never));
  return (
    <div>
      <h3>{tr("holidays.title")}</h3>
      <p className="muted">{tr("holidays.help")}</p>
      {keys.map((k) => (
        <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
          <input type="checkbox" checked={enabled.includes(k)} onChange={() => toggle(k)} />
          {tr(`holidays.set.${k}`)}
        </label>
      ))}
      <button className="btn-primary" onClick={save} disabled={busy} style={{ marginTop: 12 }}>
        {tr("holidays.save")}
      </button>
      {saved && <span className="muted" style={{ marginLeft: 10 }}>{tr("holidays.saved")}</span>}
    </div>
  );
}
```

> The `country:XX` packs are intentionally NOT surfaced in this first UI pass —
> the backend already accepts them, and an "Add country" picker is a clean
> follow-up. Confirm with the user before adding it.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TeamAdmin.tsx frontend/src/locales/en.json
git commit -m "feat(holidays): admin Holidays tab in TeamAdmin"
```

---

## Task 17: Full test sweep + Fallow

**Files:** none (verification)

- [ ] **Step 1: Backend tests**

Run: `python -m pytest backend/tasks/test_holidays_feed.py backend/tasks/test_holidays_api.py -v`
Expected: all PASS.

- [ ] **Step 2: Full backend suite (no regressions)**

Run: `python -m pytest backend -q`
Expected: all PASS.

- [ ] **Step 3: Frontend tests + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 4: Code health**

Run: `npx fallow`
Expected: no new duplication/dead-code/complexity findings in the holiday files; fix any that appear.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test(holidays): full sweep + fallow cleanup"
```

---

## Task 18: Browser QA (Playwright MCP) — verification before completion

**Files:** none (verification per workspace Rule #8)

- [ ] **Step 1: Seed data**

Ensure the dev DB has an org with default holiday sets and at least one day with both a user event and a holiday (e.g. navigate to March 2026 — Mar 7 Yogananda's Mahasamadhi; add a user event on the same day to test stacking).

- [ ] **Step 2: Start both servers**

Run backend (`python backend/manage.py runserver`) and frontend (`cd frontend && npm run dev`), then drive the live app via the Playwright MCP server.

- [ ] **Step 3: QA checklist (screenshot each)**

- Monthly view: holidays appear as muted, icon-less chips; a busy day shows "+N more"; clicking opens the day modal listing tasks + events + holidays.
- Weekly view: multiple items per day now stack (regression fix) with "+N more"; holiday chips muted.
- Light **and** dark mode: muted tone reads correctly in both.
- Admin: open Team → Holidays, untick "Hindu / yoga festivals", save, reload calendar → those holidays disappear. Re-tick → reappear.
- Non-admin member: Team modal either hides the Holidays write controls or the PATCH is rejected (403) — verify no client error.
- Console + network: no errors; `/api/holidays/range` returns 200.

- [ ] **Step 4: Write findings**

Record Bugs / UX issues / Polish with screenshots and fix recommendations (per Rule #8). Fix any Bugs before claiming done.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test(holidays): browser QA pass (weekly/monthly, light/dark, admin toggle)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Admin-controlled visibility → Tasks 2, 10, 16. ✓
- Country-extensible → `country_pack` + `provider_for` (Task 6/8), backend accepts `country:XX` (Task 10). ✓
- Five holiday sets w/ correct accuracy methods → Tasks 3–7. ✓
- Babaji = Janmashtami label → Task 7. ✓
- Separate `/api/holidays/range` endpoint → Task 9. ✓
- Muted, **no-icon** chips → Tasks 13–15. ✓
- "+N more" overflow fixing week-view bug → Tasks 12, 14. ✓
- Year-specific items excluded from feed → not implemented (correct: they stay as normal admin events). ✓
- Tests (Rule #7) + browser QA (Rule #8) → Tasks 3–17, 18. ✓
- Edge cases (year-boundary, sort order) → Task 8 tests. ✓

**Placeholder scan:** The only deferred content is the Hindu festival table years beyond 2026, which is explicitly framed as sourced data-entry with a verification method (Task 7) — not vague logic. No "TBD/TODO" in code.

**Type consistency:** `dayCells(events, holidays, max)` signature is identical in Tasks 12, 13, 14. `Holiday` shape (`title/set/holiday/start/end`) consistent across types.ts, backend spans, and consumers. Endpoint paths `holidays/range` and `holidays/settings` consistent between urls.py and tests.
