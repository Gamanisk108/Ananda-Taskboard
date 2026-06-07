from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from notifications.daily import build_payload, local_today, run_daily_push, tasks_for_user
from notifications.models import PushSubscription
from permissions.models import AccessGrant, Exclusion
from projects.models import Project, SubProject
from tasks.models import RecurrenceRule, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="Karuna"), name="Marketing")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


# --- builder selection ------------------------------------------------------

def grant_access(member, sp, level="member"):
    AccessGrant.objects.create(user=member, subproject=sp, level=level)


def test_due_today_and_overdue_selected(member, sp):
    grant_access(member, sp)
    today = local_today()
    due = Task.objects.create(subproject=sp, title="Due today", deadline=today)
    over = Task.objects.create(subproject=sp, title="Overdue", deadline=today - timedelta(days=2), status="todo")
    fut = Task.objects.create(subproject=sp, title="Future", deadline=today + timedelta(days=5))
    fut.assignees.add(member)
    due.assignees.add(member)
    over.assignees.add(member)
    due_today, overdue = tasks_for_user(member, today)
    assert due_today == ["Due today"]
    assert overdue == ["Overdue"]


def test_done_overdue_not_included(member, sp):
    grant_access(member, sp)
    today = local_today()
    t = Task.objects.create(subproject=sp, title="Done old", deadline=today - timedelta(days=3), status="done")
    t.assignees.add(member)
    _, overdue = tasks_for_user(member, today)
    assert overdue == []


def test_recurring_due_today(member, sp):
    grant_access(member, sp)
    today = local_today()
    rr = RecurrenceRule.objects.create(freq="daily", interval=1, anchor=today)
    t = Task.objects.create(subproject=sp, title="Standup", recurrence_rule=rr)
    t.assignees.add(member)
    due_today, _ = tasks_for_user(member, today)
    assert due_today == ["Standup"]


def test_unassigned_user_gets_nothing(member, sp):
    today = local_today()
    Task.objects.create(subproject=sp, title="Not mine", deadline=today)  # no assignee
    due_today, overdue = tasks_for_user(member, today)
    assert due_today == [] and overdue == []


# --- payload ----------------------------------------------------------------

def test_payload_silent_when_empty():
    assert build_payload([], []) is None


def test_payload_summarizes_counts():
    p = build_payload(["a", "b"], ["c"])
    assert "2 due today" in p["body"] and "1 overdue" in p["body"]


# --- run_daily_push idempotency --------------------------------------------

def test_daily_push_once_per_day(member, sp):
    grant_access(member, sp)
    today = local_today()
    t = Task.objects.create(subproject=sp, title="X", deadline=today)
    t.assignees.add(member)
    r1 = run_daily_push(send=False)
    assert r1["recipients"] == 1
    r2 = run_daily_push(send=False)
    assert r2["recipients"] == 0  # guard prevents a second push the same day
    member.refresh_from_db()
    assert member.last_daily_push == today


def test_user_with_nothing_is_not_a_recipient(member, sp):
    run_daily_push(send=False)  # member has no tasks
    member.refresh_from_db()
    assert member.last_daily_push == local_today()  # guard set, but silent


# --- job endpoint -----------------------------------------------------------

def test_daily_job_requires_secret(db, settings):
    settings.DAILY_PUSH_SECRET = "right"
    api = APIClient()
    assert api.post("/api/jobs/daily-push", {}, format="json").status_code == 403
    assert api.post("/api/jobs/daily-push", {}, format="json", HTTP_X_DAILY_PUSH_SECRET="wrong").status_code == 403
    ok = api.post("/api/jobs/daily-push", {}, format="json", HTTP_X_DAILY_PUSH_SECRET="right")
    assert ok.status_code == 200 and "recipients" in ok.data


# --- subscribe --------------------------------------------------------------

def test_subscribe_and_unsubscribe(member):
    api = login(member)
    sub = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}
    assert api.post("/api/push/subscribe", sub, format="json").status_code == 201
    assert PushSubscription.objects.filter(user=member).count() == 1
    assert api.delete("/api/push/subscribe", {"endpoint": sub["endpoint"]}, format="json").status_code == 204
    assert PushSubscription.objects.filter(user=member).count() == 0


def test_subscribe_invalid_rejected(member):
    res = login(member).post("/api/push/subscribe", {"endpoint": "x"}, format="json")
    assert res.status_code == 400


# --- group-chat summary -----------------------------------------------------

def test_summary_respects_visibility(member, sp):
    today = local_today()
    hidden = SubProject.objects.create(project=Project.objects.create(name="H"), name="Warehouse")
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")
    Task.objects.create(subproject=sp, title="Visible task", deadline=today)
    Task.objects.create(subproject=hidden, title="Hidden task", deadline=today)
    res = login(member).get(f"/api/summary/groupchat?date={today.isoformat()}")
    text = res.data["text"]
    assert "Visible task" in text
    assert "Hidden task" not in text


def test_summary_groups_by_person_with_emoji(admin, sp):
    today = local_today()
    t = Task.objects.create(subproject=sp, title="Flyer", deadline=today)
    t.assignees.add(admin)  # admin name "Ada"
    res = login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}")
    text = res.data["text"]
    assert "*Ada*" in text            # grouped under the person's name
    assert "Flyer" in text
    assert f"due {today.isoformat()}" in text  # deadline shown
    assert sp.project.display_emoji in text     # project emoji present


def test_summary_filter_by_assignee(admin, member, sp):
    today = local_today()
    a = Task.objects.create(subproject=sp, title="AdaTask", deadline=today); a.assignees.add(admin)
    m = Task.objects.create(subproject=sp, title="MaraTask", deadline=today); m.assignees.add(member)
    res = login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}&assignees={member.id}")
    text = res.data["text"]
    assert "MaraTask" in text and "AdaTask" not in text


def test_summary_unassigned_section(admin, sp):
    today = local_today()
    Task.objects.create(subproject=sp, title="Nobody", deadline=today)
    res = login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}")
    assert "Unassigned" in res.data["text"] and "Nobody" in res.data["text"]


def test_summary_deadline_only_shows_only_on_deadline_day(admin, sp):
    from datetime import timedelta
    today = local_today()
    Task.objects.create(subproject=sp, title="DueFriday", deadline=today + timedelta(days=2))  # no start date
    assert "DueFriday" not in login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}").data["text"]
    on_day = login(admin).get(f"/api/summary/groupchat?date={(today + timedelta(days=2)).isoformat()}").data["text"]
    assert "DueFriday" in on_day


def test_summary_date_range_only_within_range(admin, sp):
    from datetime import timedelta
    today = local_today()
    Task.objects.create(subproject=sp, title="Ranged", timeline_start=today, deadline=today + timedelta(days=3))
    assert "Ranged" in login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}").data["text"]
    before = login(admin).get(f"/api/summary/groupchat?date={(today - timedelta(days=1)).isoformat()}").data["text"]
    assert "Ranged" not in before


def test_summary_overdue_still_shows(admin, sp):
    from datetime import timedelta
    today = local_today()
    Task.objects.create(subproject=sp, title="Late", deadline=today - timedelta(days=2), status="todo")
    assert "Late" in login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}").data["text"]


def test_summary_excludes_done(admin, sp):
    today = local_today()
    Task.objects.create(subproject=sp, title="Finished", deadline=today, status="done")
    assert "Finished" not in login(admin).get(f"/api/summary/groupchat?date={today.isoformat()}").data["text"]


def test_summary_empty_message(member):
    res = login(member).get("/api/summary/groupchat")
    assert "Nothing scheduled" in res.data["text"]


# --- group-assigned tasks reach group members (Phase 2) --------------------

def test_group_assigned_task_in_member_daily(member, sp):
    from accounts.models import Group
    grant_access(member, sp)
    today = local_today()
    g = Group.objects.create(name="Crew")
    g.members.add(member)
    t = Task.objects.create(subproject=sp, title="Crew task", deadline=today)
    t.assignee_groups.add(g)
    due_today, _ = tasks_for_user(member, today)
    assert "Crew task" in due_today


def test_assigned_task_in_push_until_excluded(member, sp):
    """Policy (confirmed 2026-06-06): assignment alone confers visibility, so an
    assignee is reminded of their task even without a sub-project grant. An Exclusion
    (deny > assignment) is what removes it from the push."""
    today = local_today()
    t = Task.objects.create(subproject=sp, title="Assigned to me", deadline=today)
    t.assignees.add(member)  # assigned, no grant → still visible under the policy
    due_today, overdue = tasks_for_user(member, today)
    assert "Assigned to me" in due_today
    # deny > assignment: an Exclusion cuts it from the push too.
    Exclusion.objects.create(user=member, excluded_task=t)
    due_today2, overdue2 = tasks_for_user(member, today)
    assert "Assigned to me" not in due_today2 and "Assigned to me" not in overdue2


# --- app settings (admin, in-app) ------------------------------------------

def test_admin_reads_and_updates_settings(admin):
    api = login(admin)
    assert api.get("/api/settings").data["daily_push_hour"] == 8
    res = api.patch("/api/settings", {"daily_push_hour": 6, "timezone": "America/New_York"}, format="json")
    assert res.status_code == 200 and res.data["daily_push_hour"] == 6
    assert api.get("/api/settings").data["timezone"] == "America/New_York"


def test_settings_rejects_bad_time(admin):
    res = login(admin).patch("/api/settings", {"daily_push_hour": 99}, format="json")
    assert res.status_code == 400


def test_settings_rejects_bad_timezone(admin):
    res = login(admin).patch("/api/settings", {"timezone": "Mars/Phobos"}, format="json")
    assert res.status_code == 400


def test_member_cannot_change_settings(member):
    assert login(member).patch("/api/settings", {"daily_push_hour": 5}, format="json").status_code == 403
