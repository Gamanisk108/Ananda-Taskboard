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
