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
