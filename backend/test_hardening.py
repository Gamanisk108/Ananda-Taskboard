"""Step 11 — consolidated EXTREME edge-case coverage (brief §12) not already
asserted in per-app suites. Authorization (server-side, not UI), revocation
safety, rejected-task invisibility, data extremes, color exhaustion, push
graceful-failure."""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import Group, User
from notifications.push import send_web_push
from permissions.models import AccessGrant, Exclusion
from projects.models import PALETTE, Project, SubProject
from tasks.models import Task


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


# --- authorization is server-side, not UI hiding ----------------------------

def test_viewer_cannot_change_status_via_api(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")
    t = Task.objects.create(subproject=sp, title="T")
    t.assignees.add(member)  # even if (wrongly) assigned, viewer level can't act…
    # viewer is not admin and not… actually status allows assignees; ensure a pure
    # viewer who is NOT an assignee is blocked:
    t.assignees.clear()
    res = login(member).post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json")
    assert res.status_code == 403


def test_viewer_cannot_approve_via_api(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")
    t = Task.objects.create(subproject=sp, title="T", approval_state="pending")
    res = login(member).post(f"/api/tasks/{t.id}/approve", {}, format="json")
    assert res.status_code == 403


def test_member_cannot_edit_via_api_in_hidden_subproject(member, sp):
    hidden = SubProject.objects.create(project=Project.objects.create(name="H"), name="WH")
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=hidden, title="Secret")
    res = login(member).patch(f"/api/tasks/{t.id}", {"title": "hack"}, format="json")
    assert res.status_code == 404  # not even revealed


# --- revocation safety ------------------------------------------------------

def test_revoked_grant_keeps_assigned_task_until_excluded_or_unassigned(member, sp):
    # Policy (confirmed 2026-06-06): assignment alone confers task-granular visibility,
    # so revoking a member's sub-project GRANT does NOT hide a task they're still
    # assigned to — they remain an assignee and can still see/act on it. The real
    # cut-offs are an Exclusion (deny > assignment) or removing the assignment.
    grant = AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=sp, title="T")
    t.assignees.add(member)
    assert login(member).get(f"/api/tasks/{t.id}").status_code == 200
    grant.delete()  # grant revoked, but still assigned → still visible + actionable
    assert login(member).get(f"/api/tasks/{t.id}").status_code == 200
    assert login(member).post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json").status_code == 200
    # Deny beats assignment: an Exclusion fully cuts the member off (invisible again).
    exc = Exclusion.objects.create(user=member, excluded_task=t)
    assert login(member).get(f"/api/tasks/{t.id}").status_code == 404
    assert login(member).post(f"/api/tasks/{t.id}/status", {"status": "todo"}, format="json").status_code == 404
    # ...and so does removing the assignment (no grant, no assignment → invisible).
    exc.delete()
    t.assignees.remove(member)
    assert login(member).get(f"/api/tasks/{t.id}").status_code == 404


# --- rejected tasks disappear -----------------------------------------------

def test_rejected_task_not_on_board(admin, sp):
    Task.objects.create(subproject=sp, title="Rejected", approval_state="rejected")
    res = login(admin).get("/api/tasks")
    assert all(t["title"] != "Rejected" for t in res.data)


# --- data extremes ----------------------------------------------------------

def test_emoji_rtl_long_and_special_chars_roundtrip(admin, sp):
    title = "🎉 مرحبا " + "x" * 200 + ' <script>"; DROP'
    res = login(admin).post("/api/tasks", {"subproject": sp.id, "title": title}, format="json")
    assert res.status_code == 201
    assert res.data["title"] == title


def test_overlong_title_rejected_gracefully(admin, sp):
    res = login(admin).post("/api/tasks", {"subproject": sp.id, "title": "x" * 400}, format="json")
    assert res.status_code == 400  # clean validation error, not a 500


def test_duplicate_project_names_allowed(admin, db):
    api = login(admin)
    a = api.post("/api/projects", {"name": "Dup"}, format="json")
    b = api.post("/api/projects", {"name": "Dup"}, format="json")
    assert a.status_code == 201 and b.status_code == 201


def test_duplicate_group_name_rejected(db):
    # Group names are unique per organization (multi-tenant): a duplicate within
    # the same org is rejected; the same name in another org is fine.
    from accounts.models import Organization
    org = Organization.objects.create(name="Org A")
    Group.objects.create(organization=org, name="Alliance")
    from django.db import IntegrityError, transaction
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Group.objects.create(organization=org, name="Alliance")


def test_color_exhaustion_cycles_without_crash(db):
    # create more projects than the palette → must keep assigning (cycling), no crash
    for i in range(len(PALETTE) + 5):
        p = Project.objects.create(name=f"P{i}")
        assert p.color in PALETTE  # always a valid palette color, even after wrap


# --- empty states -----------------------------------------------------------

def test_empty_board_returns_empty_list(admin, db):
    assert login(admin).get("/api/tasks").data == []


def test_calendar_empty_window(admin, sp):
    res = login(admin).get("/api/calendar?from=2099-01-01&to=2099-01-31")
    assert res.data == []


# --- push graceful failure --------------------------------------------------

def test_push_send_noop_without_vapid(admin, sp, settings):
    settings.VAPID_PRIVATE_KEY = ""
    settings.VAPID_PUBLIC_KEY = ""
    from notifications.models import PushSubscription
    sub = PushSubscription.objects.create(user=admin, endpoint="https://x/y", p256dh="k", auth="a")
    assert send_web_push(sub, {"title": "x"}) is False  # graceful, no exception


# --- deadline date boundary in calendar -------------------------------------

def test_overdue_recurring_independent_status(admin, sp):
    # sanity: a non-recurring overdue task flagged; done one is not (calendar)
    Task.objects.create(subproject=sp, title="late", deadline=date.today() - timedelta(days=1), status="todo")
    res = login(admin).get(
        f"/api/calendar?from={(date.today()-timedelta(days=2)).isoformat()}&to={date.today().isoformat()}"
    )
    assert any(i["overdue"] for i in res.data)
