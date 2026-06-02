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
    login(admin).post("/api/events", {"date": "2026-06-10", "title": "Karuna Birthday", "yearly": True}, format="json")
    res = login(member).get("/api/events")
    assert any(e["title"] == "Karuna Birthday" for e in res.data)


def test_member_cannot_create_event(member):
    res = login(member).post("/api/events", {"date": "2026-06-10", "title": "x"}, format="json")
    assert res.status_code == 403


def test_range_expands_yearly(admin):
    CalendarEvent.objects.create(date="2000-06-10", title="Bday", yearly=True)
    CalendarEvent.objects.create(date="2026-06-15", title="One-off", yearly=False)
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-06-30")
    dates = {e["date"] for e in res.data}
    assert "2026-06-10" in dates  # yearly mapped to 2026
    assert "2026-06-15" in dates


def test_range_excludes_outside_window(admin):
    CalendarEvent.objects.create(date="2026-08-01", title="Later", yearly=False)
    res = login(admin).get("/api/events/range?from=2026-06-01&to=2026-06-30")
    assert res.data == []
