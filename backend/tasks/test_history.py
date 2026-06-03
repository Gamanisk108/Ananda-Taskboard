from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.history_service import build_day_instances, snapshot_history_day
from tasks.models import HistoryDay, RecurrenceRule, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="Sunday Service"), name="General")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_build_day_captures_assignee_names(sp, admin, member):
    t = Task.objects.create(subproject=sp, title="Flowers", deadline=date.today())
    t.assignees.add(member)
    rows = build_day_instances(date.today())
    row = next(r for r in rows if r["title"] == "Flowers")
    assert "Mara" in row["assignees"]


def test_history_is_point_in_time(sp, admin, member):
    # recurring weekly task; snapshot day 1 with Mara, reassign, snapshot day 2 with Ada
    rr = RecurrenceRule.objects.create(freq="daily", interval=1, anchor=date.today() - timedelta(days=10))
    t = Task.objects.create(subproject=sp, title="Altar", recurrence_rule=rr)
    t.assignees.add(member)
    d1 = date.today() - timedelta(days=1)
    snapshot_history_day(d1)
    # reassign and snapshot today
    t.assignees.set([admin])
    snapshot_history_day(date.today())

    h1 = HistoryDay.objects.get(date=d1)
    h2 = HistoryDay.objects.get(date=date.today())
    assert "Mara" in next(r for r in h1.instances if r["title"] == "Altar")["assignees"]
    assert "Ada" in next(r for r in h2.instances if r["title"] == "Altar")["assignees"]


def test_snapshot_upsert_and_api(admin, sp):
    Task.objects.create(subproject=sp, title="Flowers", deadline=date.today())
    snapshot_history_day(date.today())
    snapshot_history_day(date.today())  # idempotent upsert
    assert HistoryDay.objects.filter(date=date.today()).count() == 1
    res = login(admin).get(f"/api/history?from={date.today().isoformat()}&to={date.today().isoformat()}")
    assert any(i["title"] == "Flowers" and i["date"] == date.today().isoformat() for i in res.data)


def test_member_cannot_view_history(member):
    assert login(member).get(f"/api/history?from={date.today()}&to={date.today()}").status_code == 403


def test_prune_old_history(sp):
    HistoryDay.objects.create(date=date.today() - timedelta(days=400), instances=[])
    snapshot_history_day(date.today())
    assert not HistoryDay.objects.filter(date=date.today() - timedelta(days=400)).exists()
