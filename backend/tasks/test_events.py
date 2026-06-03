import pytest
from rest_framework.test import APIClient

from accounts.models import User
from tasks.models import CalendarEvent


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_admin_creates_event_member_reads(admin, member):
    login(admin).post("/api/events", {"date": "2026-06-10", "title": "Karuna Birthday", "kind": "yearly"}, format="json")
    res = login(member).get("/api/events")
    assert any(e["title"] == "Karuna Birthday" for e in res.data)


def test_member_cannot_create_event(member):
    res = login(member).post("/api/events", {"date": "2026-06-10", "title": "x"}, format="json")
    assert res.status_code == 403


def test_range_expands_yearly(admin):
    CalendarEvent.objects.create(date="2000-06-10", title="Bday", kind="yearly")
    CalendarEvent.objects.create(date="2026-06-15", title="One-off", kind="single")
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-06-30")
    starts = {e["start"] for e in res.data}
    assert "2026-06-10" in starts  # yearly mapped to 2026
    assert "2026-06-15" in starts
    yearly = next(e for e in res.data if e["title"] == "Bday")
    assert yearly["yearly"] is True and yearly["kind"] == "yearly"


def test_range_excludes_outside_window(admin):
    CalendarEvent.objects.create(date="2026-08-01", title="Later", kind="single")
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-06-30")
    assert res.data == []


def test_range_event_emits_true_span(admin):
    # A retreat that starts before and ends inside the window.
    CalendarEvent.objects.create(kind="range", date="2026-05-30", end_date="2026-06-03", title="Retreat")
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-06-30")
    span = next(e for e in res.data if e["title"] == "Retreat")
    assert span["start"] == "2026-05-30" and span["end"] == "2026-06-03"  # true (unclipped) span
    assert span["kind"] == "range"


def test_repeating_sat_and_sun_for_four_weeks(admin):
    # Anchor Sat 2026-06-06; Sat+Sun (Mon=0..Sun=6 -> 5,6); 4 weeks.
    CalendarEvent.objects.create(
        kind="repeating", date="2026-06-06", weekdays="5,6", interval=1, count=4, title="Yoga"
    )
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-07-31")
    starts = sorted(e["start"] for e in res.data if e["title"] == "Yoga")
    assert starts == [
        "2026-06-06", "2026-06-07",
        "2026-06-13", "2026-06-14",
        "2026-06-20", "2026-06-21",
        "2026-06-27", "2026-06-28",
    ]


def test_range_validation_rejects_end_before_start(admin):
    res = login(admin).post(
        "/api/events",
        {"kind": "range", "date": "2026-06-10", "end_date": "2026-06-05", "title": "bad"},
        format="json",
    )
    assert res.status_code == 400


def test_repeating_validation_requires_weekdays(admin):
    res = login(admin).post(
        "/api/events",
        {"kind": "repeating", "date": "2026-06-06", "weekdays": [], "count": 4, "title": "bad"},
        format="json",
    )
    assert res.status_code == 400


def test_weekdays_roundtrip_as_list(admin):
    login(admin).post(
        "/api/events",
        {"kind": "repeating", "date": "2026-06-06", "weekdays": [6, 5], "count": 2, "title": "W"},
        format="json",
    )
    ev = CalendarEvent.objects.get(title="W")
    assert ev.weekdays == "5,6"  # stored sorted CSV
    res = login(admin).get("/api/events")
    row = next(e for e in res.data if e["title"] == "W")
    assert row["weekdays"] == [5, 6]  # exposed as list of ints
