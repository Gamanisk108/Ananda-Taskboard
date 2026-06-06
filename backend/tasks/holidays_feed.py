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
