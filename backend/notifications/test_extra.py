"""Extra PWA notifications (free, web push): deadline 'due tomorrow' heads-up
and real-time assignment-change pings."""
from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from notifications import daily as daily_mod
from notifications.daily import build_payload, local_today, tasks_due_soon
from notifications.models import PushSubscription
from permissions.models import AccessGrant
from projects.models import Project, SubProject


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda", is_active=True)


def _user(org, email, role="member", **kw):
    u = User.objects.create_user(email=email, password="pw-strong-123", **kw)
    Membership.objects.create(user=u, organization=org, role=role, is_active=True)
    return u


@pytest.fixture
def admin(org):
    return _user(org, "a@x.com", role="admin", is_staff=True, is_superuser=True)


@pytest.fixture
def member(org):
    return _user(org, "m@x.com")


@pytest.fixture
def sp(db, org):
    return SubProject.objects.create(project=Project.objects.create(name="K", organization=org), name="Mktg")


# ---- deadline reminders (due tomorrow) -------------------------------------

def test_due_soon_picks_tomorrow(member, sp):
    from tasks.models import Task
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    today = local_today()
    tmrw = Task.objects.create(subproject=sp, title="Tomorrow", deadline=today + timedelta(days=1))
    today_t = Task.objects.create(subproject=sp, title="Today", deadline=today)
    tmrw.assignees.add(member)
    today_t.assignees.add(member)
    soon = tasks_due_soon(member, today)
    assert soon == ["Tomorrow"]


def test_payload_includes_due_tomorrow():
    p = build_payload([], [], ["A", "B"])
    assert p is not None and "2 due tomorrow" in p["body"]


def test_deadline_reminder_respects_optout(member, sp, monkeypatch):
    from tasks.models import Task
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    today = local_today()
    t = Task.objects.create(subproject=sp, title="Tomorrow", deadline=today + timedelta(days=1))
    t.assignees.add(member)
    member.deadline_reminders = False
    member.save(update_fields=["deadline_reminders"])
    # With reminders off and nothing due today/overdue, the digest stays silent.
    res = daily_mod.run_daily_push(send=False)
    assert res["recipients"] == 0


# ---- assignment-change pings -----------------------------------------------

def _capture_push(monkeypatch):
    # Dispatch is async (ThreadPoolExecutor) since 01-async-web-push; patch the
    # dispatcher itself so assertions right after the request aren't racing a
    # pool thread.
    sent = []
    monkeypatch.setattr("notifications.push.send_web_push_async", lambda sub, payload: sent.append(payload))
    return sent


def test_assignment_push_when_opted_in(admin, member, sp, monkeypatch):
    member.assignment_changes = True
    member.save(update_fields=["assignment_changes"])
    PushSubscription.objects.create(user=member, endpoint="https://p/e", p256dh="k", auth="a")
    sent = _capture_push(monkeypatch)
    c = APIClient(); c.force_authenticate(user=admin)
    h = {"HTTP_X_ORG_ID": str(sp.project.organization_id)}
    r = c.post("/api/tasks", {"subproject": sp.id, "title": "Assigned task",
                              "assignees": [member.id]}, format="json", **h)
    assert r.status_code == 201, r.content
    assert any("Assigned task" in p["body"] for p in sent)


def test_no_assignment_push_when_opted_out(admin, member, sp, monkeypatch):
    member.assignment_changes = False
    member.save(update_fields=["assignment_changes"])
    PushSubscription.objects.create(user=member, endpoint="https://p/e", p256dh="k", auth="a")
    sent = _capture_push(monkeypatch)
    c = APIClient(); c.force_authenticate(user=admin)
    h = {"HTTP_X_ORG_ID": str(sp.project.organization_id)}
    c.post("/api/tasks", {"subproject": sp.id, "title": "Quiet task",
                          "assignees": [member.id]}, format="json", **h)
    assert sent == []


def test_mention_push_dispatch_is_non_blocking(admin, member, sp, monkeypatch):
    """01-async-web-push: a slow push service must not hold the request thread —
    the comment-create response must return long before a slow send finishes."""
    import time

    from tasks.models import Task

    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    task = Task.objects.create(subproject=sp, title="Mention me")
    PushSubscription.objects.create(user=member, endpoint="https://p/e3", p256dh="k", auth="a")

    def slow_send(sub, payload):
        time.sleep(0.5)
        return True

    monkeypatch.setattr("notifications.push.send_web_push", slow_send)

    c = APIClient(); c.force_authenticate(user=admin)
    h = {"HTTP_X_ORG_ID": str(sp.project.organization_id)}
    start = time.monotonic()
    r = c.post(
        f"/api/tasks/{task.id}/comments",
        {"text": "hi @member", "mentions": [member.id]},
        format="json",
        **h,
    )
    elapsed = time.monotonic() - start
    assert r.status_code == 201, r.content
    assert elapsed < 0.5, f"comment POST took {elapsed:.2f}s — push dispatch is blocking the request"
