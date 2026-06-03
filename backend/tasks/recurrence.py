"""Recurrence engine — turns a RecurrenceRule into concrete occurrence dates over
a window, and materializes TaskOccurrence rows (each with its own status).

Edge-case policy (brief §12), made explicit:
- **Monthly on the 31st** fires ONLY in months that actually have that day
  (Feb / 30-day months are skipped — no silent roll-over to the 28th/30th).
- **Yearly on Feb 29** fires ONLY in leap years (other years skipped).
- **count** stops after exactly N fired occurrences (counted from the anchor,
  including any before the query window). Skipped invalid slots don't consume it.
- **end_date** is inclusive; occurrences stop exactly at it (no off-by-one).
- Indefinite rules are bounded only by the query window.
- Dates are timezone-naive calendar dates, so DST never shifts which day an
  occurrence lands on; the daily-push layer (step 10) applies local-time gating.
- Editing a rule affects FUTURE occurrences only — already-materialized
  TaskOccurrence rows keep their status (materialize never overwrites them).
"""

import calendar
from datetime import date, timedelta

MAX_SLOTS = 100_000  # safety bound against pathological loops


def _slot(rule, n):
    """Return (nominal_date, valid_date_or_None) for the nth slot (n >= 0).

    `nominal_date` always advances monotonically (used for termination even when
    a slot is invalid); `valid_date` is None when the calendar day doesn't exist.
    """
    if rule.freq == "daily":
        d = rule.anchor + timedelta(days=n * rule.interval)
        return d, d
    if rule.freq == "weekly":
        d = rule.anchor + timedelta(weeks=n * rule.interval)
        return d, d
    if rule.freq == "monthly":
        month_index = (rule.anchor.month - 1) + n * rule.interval
        year = rule.anchor.year + month_index // 12
        month = month_index % 12 + 1
        nominal = date(year, month, 1)
        day = rule.anchor.day
        if day > calendar.monthrange(year, month)[1]:
            return nominal, None  # e.g. 31st in a short month → skip
        return nominal, date(year, month, day)
    if rule.freq == "yearly":
        year = rule.anchor.year + n * rule.interval
        month, day = rule.anchor.month, rule.anchor.day
        nominal = date(year, 1, 1)
        if month == 2 and day == 29 and not calendar.isleap(year):
            return nominal, None  # Feb 29 in non-leap year → skip
        return nominal, date(year, month, day)
    raise ValueError(f"Unknown freq: {rule.freq}")


def _fast_forward_start(rule, window_start):
    """First slot index whose nominal date is at/just-before window_start, so we
    don't iterate from the anchor across long gaps. Safe ONLY when count is None
    (count must be counted from the anchor)."""
    if window_start <= rule.anchor:
        return 0
    if rule.freq == "daily":
        return max(0, (window_start - rule.anchor).days // rule.interval - 1)
    if rule.freq == "weekly":
        return max(0, (window_start - rule.anchor).days // (7 * rule.interval) - 1)
    if rule.freq == "monthly":
        months = (window_start.year - rule.anchor.year) * 12 + (window_start.month - rule.anchor.month)
        return max(0, months // rule.interval - 1)
    if rule.freq == "yearly":
        years = window_start.year - rule.anchor.year
        return max(0, years // rule.interval - 1)
    return 0


def occurrence_dates(rule, window_start, window_end):
    """All occurrence dates of `rule` within [window_start, window_end] inclusive."""
    if window_end < rule.anchor:
        return []
    dates = []
    fired = 0  # count of occurrences that have fired from the anchor onward
    n = _fast_forward_start(rule, window_start) if rule.count is None else 0
    # When fast-forwarding, fired is unknown — but fast-forward is only used when
    # count is None, so fired is never consulted for a cap in that branch.
    for _ in range(MAX_SLOTS):
        nominal, valid = _slot(rule, n)
        n += 1
        if nominal > window_end:
            break
        if valid is None:
            # invalid slot: still check end_date termination via nominal
            if rule.end_date is not None and nominal > rule.end_date:
                break
            continue
        if rule.count is not None and fired >= rule.count:
            break
        if rule.end_date is not None and valid > rule.end_date:
            break
        if window_start <= valid <= window_end:
            dates.append(valid)
        fired += 1
    return dates


def event_weekly_dates(anchor, weekdays, interval=1, count=None, end_date=None,
                       window_start=None, window_end=None):
    """Weekly multi-weekday recurrence for CalendarEvents (distinct from the task
    engine above, which fires on a single weekday).

    - `weekdays`: ints Mon=0..Sun=6. Weeks are indexed from the Monday of
      `anchor`'s week; active weeks step by `interval`.
    - `count`: cap on the number of ACTIVE weeks (None = unbounded).
    - `end_date`: inclusive last day (None = unbounded).
    - A day fires only if it is >= anchor, <= end_date, and within the window.

    Returns sorted dates in [window_start, window_end].
    """
    wds = sorted({int(w) for w in weekdays})
    if not wds:
        return []
    interval = max(1, interval or 1)
    week0_monday = anchor - timedelta(days=anchor.weekday())

    # Fast-forward toward the window so an old anchor doesn't cost a long loop.
    # Only safe when count is None (count must be measured from week 0).
    k = 0
    if count is None and window_start is not None and window_start > week0_monday:
        k = max(0, (window_start - week0_monday).days // (7 * interval) - 1)

    out = []
    iterations = 0
    while iterations < MAX_SLOTS:
        iterations += 1
        if count is not None and k >= count:
            break
        week_monday = week0_monday + timedelta(weeks=k * interval)
        if window_end is not None and week_monday > window_end:
            break
        if end_date is not None and week_monday > end_date:
            break
        for wd in wds:
            d = week_monday + timedelta(days=wd)
            if d < anchor:
                continue
            if end_date is not None and d > end_date:
                continue
            if window_start is not None and d < window_start:
                continue
            if window_end is not None and d > window_end:
                continue
            out.append(d)
        k += 1
    out.sort()
    return out


def materialize_occurrences(task, window_start, window_end):
    """Create any missing TaskOccurrence rows for a recurring task within the
    window and return all of the task's occurrences in that window (ordered).

    Existing occurrences are never modified — their per-occurrence status is
    preserved, so editing the rule only affects newly created (future) dates.
    Non-recurring tasks return []."""
    from .models import TaskOccurrence

    if not task.is_recurring:
        return []
    wanted = occurrence_dates(task.recurrence_rule, window_start, window_end)
    existing = set(
        task.occurrences.filter(date__in=wanted).values_list("date", flat=True)
    )
    to_create = [
        TaskOccurrence(task=task, date=d, status=task.status)
        for d in wanted
        if d not in existing
    ]
    if to_create:
        TaskOccurrence.objects.bulk_create(to_create, ignore_conflicts=True)
    return list(
        task.occurrences.filter(date__gte=window_start, date__lte=window_end).order_by("date")
    )
