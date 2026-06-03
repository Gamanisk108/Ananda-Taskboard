from datetime import date

from tasks.recurrence import event_weekly_dates

# Weekday ints: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6.
SAT, SUN = 5, 6


def test_sat_and_sun_for_four_weeks():
    # Anchor is a Saturday; Sat+Sun, 4 active weeks -> 8 dates.
    out = event_weekly_dates(date(2026, 6, 6), [SAT, SUN], interval=1, count=4)
    assert out == [
        date(2026, 6, 6), date(2026, 6, 7),
        date(2026, 6, 13), date(2026, 6, 14),
        date(2026, 6, 20), date(2026, 6, 21),
        date(2026, 6, 27), date(2026, 6, 28),
    ]


def test_days_before_anchor_excluded():
    # Anchor Sunday 2026-06-07; Sat+Sun. The Saturday of anchor's week (06-06)
    # is before the anchor and must be excluded; first fire is the anchor itself.
    out = event_weekly_dates(date(2026, 6, 7), [SAT, SUN], count=2)
    assert out[0] == date(2026, 6, 7)
    assert date(2026, 6, 6) not in out
    assert out == [date(2026, 6, 7), date(2026, 6, 13), date(2026, 6, 14)]


def test_interval_every_two_weeks():
    out = event_weekly_dates(date(2026, 6, 6), [SAT], interval=2, count=3)
    assert out == [date(2026, 6, 6), date(2026, 6, 20), date(2026, 7, 4)]


def test_end_date_inclusive():
    out = event_weekly_dates(date(2026, 6, 6), [SAT, SUN], end_date=date(2026, 6, 14))
    assert out == [date(2026, 6, 6), date(2026, 6, 7), date(2026, 6, 13), date(2026, 6, 14)]


def test_window_clipping():
    out = event_weekly_dates(
        date(2026, 6, 6), [SAT, SUN], count=4,
        window_start=date(2026, 6, 13), window_end=date(2026, 6, 21),
    )
    assert out == [date(2026, 6, 13), date(2026, 6, 14), date(2026, 6, 20), date(2026, 6, 21)]


def test_empty_weekdays_returns_nothing():
    assert event_weekly_dates(date(2026, 6, 6), [], count=4) == []


def test_unbounded_is_clipped_to_window_only():
    # No count, no end_date: bounded only by the query window (fast-forward path).
    out = event_weekly_dates(
        date(2020, 1, 4), [SAT], window_start=date(2026, 6, 1), window_end=date(2026, 6, 30),
    )
    assert out == [date(2026, 6, 6), date(2026, 6, 13), date(2026, 6, 20), date(2026, 6, 27)]
