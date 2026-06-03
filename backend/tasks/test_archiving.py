from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.archiving import archive_completed, auto_complete_overdue
from tasks.models import RecurrenceRule, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def _age(task, days):
    Task.objects.filter(pk=task.pk).update(updated_at=timezone.now() - timedelta(days=days))


def test_archive_old_done_tasks_only(sp):
    old_done = Task.objects.create(subproject=sp, title="OldDone", status="done"); _age(old_done, 8)
    recent_done = Task.objects.create(subproject=sp, title="RecentDone", status="done"); _age(recent_done, 2)
    old_open = Task.objects.create(subproject=sp, title="OldOpen", status="todo"); _age(old_open, 30)
    n = archive_completed(days=7)
    assert n == 1
    old_done.refresh_from_db(); recent_done.refresh_from_db(); old_open.refresh_from_db()
    assert old_done.archived_at is not None
    assert recent_done.archived_at is None   # not old enough
    assert old_open.archived_at is None       # not done


def test_archived_hidden_from_list_shown_under_flag(admin, sp):
    t = Task.objects.create(subproject=sp, title="Gone", status="done")
    Task.objects.filter(pk=t.pk).update(archived_at=timezone.now())
    api = login(admin)
    assert all(x["title"] != "Gone" for x in api.get("/api/tasks").data)            # hidden
    assert any(x["title"] == "Gone" for x in api.get("/api/tasks?archived=1").data)  # in archive


def test_done_excluded_from_calendar(admin, sp):
    Task.objects.create(subproject=sp, title="DoneToday", deadline=date.today(), status="done")
    res = login(admin).get(f"/api/calendar?from={date.today().isoformat()}&to={date.today().isoformat()}")
    assert all(i["title"] != "DoneToday" for i in res.data)


def test_unarchive_recovers(admin, sp):
    t = Task.objects.create(subproject=sp, title="Back", status="done")
    Task.objects.filter(pk=t.pk).update(archived_at=timezone.now())
    res = login(admin).post(f"/api/tasks/{t.id}/unarchive", {}, format="json")
    assert res.status_code == 200
    t.refresh_from_db()
    assert t.archived_at is None


def test_auto_complete_marks_past_due(sp):
    past = Task.objects.create(subproject=sp, title="Mundane", deadline=date.today() - timedelta(days=1), auto_complete=True)
    future = Task.objects.create(subproject=sp, title="Future", deadline=date.today() + timedelta(days=1), auto_complete=True)
    normal = Task.objects.create(subproject=sp, title="Manual", deadline=date.today() - timedelta(days=1))  # no flag
    n = auto_complete_overdue()
    assert n == 1
    past.refresh_from_db(); future.refresh_from_db(); normal.refresh_from_db()
    assert past.status == "done"
    assert future.status != "done"   # not past due
    assert normal.status != "done"   # not flagged


def test_auto_complete_skips_recurring(sp):
    rr = RecurrenceRule.objects.create(freq="weekly", interval=1, anchor=date.today() - timedelta(days=7))
    t = Task.objects.create(subproject=sp, title="Weekly", recurrence_rule=rr, deadline=date.today() - timedelta(days=1), auto_complete=True)
    auto_complete_overdue()
    t.refresh_from_db()
    assert t.status != "done"  # recurring tasks aren't auto-completed (they recur)


def test_member_with_access_can_unarchive(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=sp, title="X", status="done")
    Task.objects.filter(pk=t.pk).update(archived_at=timezone.now())
    assert login(member).post(f"/api/tasks/{t.id}/unarchive", {}, format="json").status_code == 200
