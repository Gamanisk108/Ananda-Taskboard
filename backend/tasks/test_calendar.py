from datetime import date

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import RecurrenceRule, Task


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


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


def test_non_recurring_task_on_deadline(admin, sp):
    # start == deadline → exactly one day on the deadline
    Task.objects.create(subproject=sp, title="Due", timeline_start=date(2026, 6, 10), deadline=date(2026, 6, 10))
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    assert res.status_code == 200
    assert len(res.data) == 1 and res.data[0]["date"] == "2026-06-10" and res.data[0]["is_deadline"]


def test_task_spans_start_to_deadline(admin, sp):
    # start June 1, due June 5 → appears on all 5 days, with is_deadline only on the 5th
    Task.objects.create(subproject=sp, title="Flyer", timeline_start=date(2026, 6, 1), deadline=date(2026, 6, 5))
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    dates = sorted(i["date"] for i in res.data)
    assert dates == ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"]
    deadline_days = [i["date"] for i in res.data if i["is_deadline"]]
    assert deadline_days == ["2026-06-05"]


def test_deadline_only_shows_only_on_deadline(admin, sp):
    # No start date → a bare due-date is a single point: it appears ONLY on the
    # deadline day, never spanning back to the creation date.
    from datetime import date as _date, timedelta
    today = _date.today()
    deadline = today + timedelta(days=3)
    Task.objects.create(subproject=sp, title="DueSoon", deadline=deadline)
    res = login(admin).get(f"/api/calendar?from={(today - timedelta(days=2)).isoformat()}&to={(today + timedelta(days=10)).isoformat()}")
    dates = sorted(i["date"] for i in res.data)
    assert dates == [deadline.isoformat()]
    assert res.data[0]["is_deadline"]


def test_span_clipped_to_window(admin, sp):
    Task.objects.create(subproject=sp, title="Long", timeline_start=date(2026, 5, 28), deadline=date(2026, 6, 3))
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    dates = sorted(i["date"] for i in res.data)
    assert dates == ["2026-06-01", "2026-06-02", "2026-06-03"]  # clipped at window start


def test_recurring_task_expanded(admin, sp):
    rr = RecurrenceRule.objects.create(freq="weekly", interval=1, anchor=date(2026, 6, 1))
    Task.objects.create(subproject=sp, title="Standup", recurrence_rule=rr)
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    assert len(res.data) == 5  # 5 weekly occurrences in June 2026
    assert all(i["is_recurring"] for i in res.data)


def test_overdue_flagged(admin, sp):
    Task.objects.create(subproject=sp, title="Old", deadline=date(2020, 1, 1), status="todo")
    res = login(admin).get("/api/calendar?from=2019-01-01&to=2021-01-01")
    assert res.data[0]["overdue"] is True


def test_done_excluded(admin, sp):
    # Completed tasks drop off the calendar entirely (so never flagged overdue).
    Task.objects.create(subproject=sp, title="Old", deadline=date(2020, 1, 1), status="done")
    res = login(admin).get("/api/calendar?from=2019-01-01&to=2021-01-01")
    assert res.data == []


def test_pending_excluded(admin, sp):
    Task.objects.create(subproject=sp, title="P", deadline=date(2026, 6, 5), approval_state="pending")
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    assert res.data == []


def test_member_calendar_respects_visibility(member, sp):
    hidden = SubProject.objects.create(project=Project.objects.create(name="H"), name="Hidden")
    from accounts.models import Tier
    member.tier = Tier.objects.create(name="Sub-Project Only", default_sees="subproject")
    member.save(update_fields=["tier"])
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")
    Task.objects.create(subproject=sp, title="Mine", deadline=date(2026, 6, 5))
    Task.objects.create(subproject=hidden, title="NotMine", deadline=date(2026, 6, 5))
    res = login(member).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    titles = {i["title"] for i in res.data}  # may span multiple days → use a set
    assert "Mine" in titles and "NotMine" not in titles


def test_bad_date_returns_400(admin, sp):
    res = login(admin).get("/api/calendar?from=nope&to=2026-06-30")
    assert res.status_code == 400
