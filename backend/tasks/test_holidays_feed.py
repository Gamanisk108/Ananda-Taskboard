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


from tasks.holidays_feed import hindu_festivals


def test_janmashtami_2026_is_sept_4_and_labels_babaji():
    days = dict((title, d) for d, title in hindu_festivals(2026))
    assert days["Janmashtami (Babaji Commemoration Day)"] == date(2026, 9, 4)


def test_hindu_unknown_year_returns_empty_not_error():
    assert hindu_festivals(1900) == []


def test_hindu_festivals_have_titles_and_dates():
    for d, title in hindu_festivals(2026):
        assert isinstance(d, date) and isinstance(title, str) and title
