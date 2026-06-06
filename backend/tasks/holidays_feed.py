"""Computed holiday feed.

Each holiday SET is a key mapped to a provider `occurrences(year) -> [(date, title)]`.
The active org's enabled set keys are merged over a date window into span dicts.
Deterministic sets are computed (library / algorithm); the lunar Hindu festivals
are table-driven. Results per (set, year) are deterministic and cached.
"""

from datetime import date, timedelta

from dateutil.easter import easter
import holidays as pyholidays

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


# ---- Country packs via the `holidays` library (extensible) -----------------
def country_pack(code):
    """A provider for one ISO country code (e.g. 'US', 'IT'). The library
    handles observed-date shifts automatically."""
    def provider(year):
        items = pyholidays.country_holidays(code, years=year)
        return sorted(items.items())  # [(date, name), ...]
    return provider


us_federal = country_pack("US")


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
