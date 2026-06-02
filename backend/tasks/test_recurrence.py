from datetime import date

import pytest

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import RecurrenceRule, Task
from tasks.recurrence import materialize_occurrences, occurrence_dates


def rule(freq, anchor, interval=1, end_date=None, count=None):
    return RecurrenceRule(freq=freq, interval=interval, anchor=anchor, end_date=end_date, count=count)


# --- basic frequencies ------------------------------------------------------

def test_daily_within_window():
    r = rule("daily", date(2026, 6, 1))
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 6, 5))
    assert out == [date(2026, 6, d) for d in (1, 2, 3, 4, 5)]


def test_daily_interval_every_three_days():
    r = rule("daily", date(2026, 6, 1), interval=3)
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 6, 10))
    assert out == [date(2026, 6, 1), date(2026, 6, 4), date(2026, 6, 7), date(2026, 6, 10)]


def test_weekly():
    r = rule("weekly", date(2026, 6, 1))
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 6, 30))
    assert out == [date(2026, 6, 1), date(2026, 6, 8), date(2026, 6, 15), date(2026, 6, 22), date(2026, 6, 29)]


def test_monthly_normal():
    r = rule("monthly", date(2026, 1, 15))
    out = occurrence_dates(r, date(2026, 1, 1), date(2026, 4, 30))
    assert out == [date(2026, 1, 15), date(2026, 2, 15), date(2026, 3, 15), date(2026, 4, 15)]


# --- the ludicrous-but-real ones --------------------------------------------

def test_monthly_31st_skips_short_months():
    r = rule("monthly", date(2026, 1, 31))
    out = occurrence_dates(r, date(2026, 1, 1), date(2026, 12, 31))
    # only months with 31 days fire: Jan, Mar, May, Jul, Aug, Oct, Dec
    assert out == [date(2026, m, 31) for m in (1, 3, 5, 7, 8, 10, 12)]
    assert date(2026, 2, 28) not in out  # no silent roll-over into February


def test_monthly_31st_february_skipped_no_rollover():
    r = rule("monthly", date(2026, 1, 31))
    out = occurrence_dates(r, date(2026, 2, 1), date(2026, 2, 28))
    assert out == []  # February has no 31st → nothing, not the 28th


def test_yearly_feb29_only_in_leap_years():
    r = rule("yearly", date(2024, 2, 29))  # 2024 is leap
    out = occurrence_dates(r, date(2024, 1, 1), date(2032, 12, 31))
    assert out == [date(2024, 2, 29), date(2028, 2, 29), date(2032, 2, 29)]
    assert date(2025, 2, 28) not in out


def test_yearly_normal():
    r = rule("yearly", date(2026, 7, 4))
    out = occurrence_dates(r, date(2026, 1, 1), date(2029, 12, 31))
    assert out == [date(2026, 7, 4), date(2027, 7, 4), date(2028, 7, 4), date(2029, 7, 4)]


# --- stop conditions (exact) ------------------------------------------------

def test_count_stops_exactly():
    r = rule("daily", date(2026, 6, 1), count=3)
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 12, 31))
    assert out == [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)]


def test_count_counts_from_anchor_even_before_window():
    # 3 total occurrences from Jun 1; a window starting Jun 3 should see only #3.
    r = rule("daily", date(2026, 6, 1), count=3)
    out = occurrence_dates(r, date(2026, 6, 3), date(2026, 6, 30))
    assert out == [date(2026, 6, 3)]


def test_end_date_inclusive_no_off_by_one():
    r = rule("daily", date(2026, 6, 1), end_date=date(2026, 6, 3))
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 6, 30))
    assert out == [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)]  # 3 included, 4 excluded


def test_indefinite_bounded_by_window():
    r = rule("daily", date(2026, 1, 1))
    out = occurrence_dates(r, date(2026, 6, 10), date(2026, 6, 12))
    assert out == [date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12)]


# --- boundaries -------------------------------------------------------------

def test_month_boundary_window():
    r = rule("daily", date(2026, 1, 1))
    out = occurrence_dates(r, date(2026, 1, 30), date(2026, 2, 2))
    assert out == [date(2026, 1, 30), date(2026, 1, 31), date(2026, 2, 1), date(2026, 2, 2)]


def test_year_boundary_window():
    r = rule("daily", date(2026, 12, 30))
    out = occurrence_dates(r, date(2026, 12, 30), date(2027, 1, 2))
    assert out == [date(2026, 12, 30), date(2026, 12, 31), date(2027, 1, 1), date(2027, 1, 2)]


def test_window_before_anchor_is_empty():
    r = rule("daily", date(2026, 6, 1))
    assert occurrence_dates(r, date(2026, 1, 1), date(2026, 5, 31)) == []


def test_fast_forward_far_window_matches_naive():
    # anchor years before the window; fast-forward must not change results
    r = rule("daily", date(2020, 1, 1))
    out = occurrence_dates(r, date(2026, 6, 1), date(2026, 6, 3))
    assert out == [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)]


# --- materialization (DB) ---------------------------------------------------

@pytest.fixture
def recurring_task(db):
    p = Project.objects.create(name="P")
    sp = SubProject.objects.create(project=p, name="SP")
    rr = RecurrenceRule.objects.create(freq="daily", interval=1, anchor=date(2026, 6, 1))
    return Task.objects.create(subproject=sp, title="Daily standup", recurrence_rule=rr)


def test_materialize_creates_occurrences(recurring_task):
    occ = materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 3))
    assert [o.date for o in occ] == [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)]


def test_per_occurrence_status_independent(recurring_task):
    occ = materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 3))
    occ[0].status = "done"
    occ[0].save()
    # re-materialize the same window: existing statuses preserved, not reset
    again = materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 3))
    by_date = {o.date: o.status for o in again}
    assert by_date[date(2026, 6, 1)] == "done"
    assert by_date[date(2026, 6, 2)] == "todo"


def test_rule_edit_affects_future_not_past(recurring_task):
    # materialize + mark a past occurrence done
    materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 5))
    past = recurring_task.occurrences.get(date=date(2026, 6, 1))
    past.status = "done"
    past.save()
    # change the rule (e.g. now every 2 days); past occurrence must keep its status
    recurring_task.recurrence_rule.interval = 2
    recurring_task.recurrence_rule.save()
    materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 9))
    past.refresh_from_db()
    assert past.status == "done"  # untouched


def test_materialize_idempotent_no_duplicates(recurring_task):
    materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 3))
    materialize_occurrences(recurring_task, date(2026, 6, 1), date(2026, 6, 3))
    assert recurring_task.occurrences.count() == 3  # no duplicates
