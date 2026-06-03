from datetime import date

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


def _create(api, sp, **extra):
    body = {"subproject": sp.id, "title": "Class"}
    body.update(extra)
    return api.post("/api/tasks", body, format="json")


def test_timed_task_saves(admin, sp):
    res = _create(login(admin), sp, start_time="13:00", end_time="16:00")
    assert res.status_code == 201
    t = Task.objects.get(id=res.data["id"])
    assert t.start_time.strftime("%H:%M") == "13:00" and t.end_time.strftime("%H:%M") == "16:00"


def test_untimed_task_is_allowed(admin, sp):
    res = _create(login(admin), sp)
    assert res.status_code == 201
    assert res.data["start_time"] is None and res.data["end_time"] is None


def test_start_without_end_rejected(admin, sp):
    res = _create(login(admin), sp, start_time="13:00")
    assert res.status_code == 400


def test_end_before_start_rejected(admin, sp):
    res = _create(login(admin), sp, start_time="16:00", end_time="13:00")
    assert res.status_code == 400


def test_calendar_instance_includes_times(admin, sp):
    Task.objects.create(
        subproject=sp, title="Yoga", deadline=date(2026, 6, 10),
        timeline_start=date(2026, 6, 10), start_time="13:00", end_time="16:00",
    )
    res = login(admin).get("/api/calendar?from=2026-06-01&to=2026-06-30")
    inst = res.data[0]
    assert inst["start_time"] == "13:00" and inst["end_time"] == "16:00"


def test_priority_defaults_to_medium(admin, sp):
    res = _create(login(admin), sp)
    assert res.data["priority"] == 3  # Medium


def test_priority_can_be_set(admin, sp):
    res = _create(login(admin), sp, priority=5)
    assert res.status_code == 201 and res.data["priority"] == 5
