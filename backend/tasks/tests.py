import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def other(db):
    return User.objects.create_user(email="o@example.com", name="Omar", password="pw-strong-123")


@pytest.fixture
def sp(db):
    p = Project.objects.create(name="Karuna Devi")
    return SubProject.objects.create(project=p, name="Marketing")


@pytest.fixture
def hidden_sp(db):
    p = Project.objects.create(name="Secret")
    return SubProject.objects.create(project=p, name="Warehouse")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def make_task(sp, **kw):
    kw.setdefault("approval_state", Task.Approval.APPROVED)
    return Task.objects.create(subproject=sp, title=kw.pop("title", "T"), **kw)


# --- creation + approval ----------------------------------------------------

def test_member_create_untrusted_is_pending(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    res = login(member).post("/api/tasks", {"subproject": sp.id, "title": "Flyer"}, format="json")
    assert res.status_code == 201
    assert res.data["approval_state"] == "pending"


def test_member_create_trusted_is_approved(member, sp):
    sp.members_post_without_approval = True
    sp.save()
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    res = login(member).post("/api/tasks", {"subproject": sp.id, "title": "Flyer"}, format="json")
    assert res.data["approval_state"] == "approved"


def test_admin_create_is_live(admin, sp):
    res = login(admin).post("/api/tasks", {"subproject": sp.id, "title": "Flyer"}, format="json")
    assert res.data["approval_state"] == "approved"


def test_viewer_cannot_create(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")
    res = login(member).post("/api/tasks", {"subproject": sp.id, "title": "X"}, format="json")
    assert res.status_code == 403


def test_no_access_cannot_create_in_hidden_subproject(member, hidden_sp):
    res = login(member).post("/api/tasks", {"subproject": hidden_sp.id, "title": "X"}, format="json")
    assert res.status_code == 403  # existence not revealed


# --- visibility / IDOR ------------------------------------------------------

def test_pending_task_invisible_on_live_board(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    make_task(sp, title="Live", approval_state=Task.Approval.APPROVED)
    make_task(sp, title="Hidden", approval_state=Task.Approval.PENDING)
    res = login(member).get("/api/tasks")
    titles = [t["title"] for t in res.data]
    assert "Live" in titles and "Hidden" not in titles


def test_member_cannot_read_task_in_hidden_subproject(member, sp, hidden_sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(hidden_sp, title="Secret")
    res = login(member).get(f"/api/tasks/{t.id}")
    assert res.status_code == 404  # IDOR-safe: not data


def test_no_cross_leak_in_list(member, sp, hidden_sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    make_task(sp, title="Mine")
    make_task(hidden_sp, title="NotMine")
    res = login(member).get("/api/tasks")
    titles = [t["title"] for t in res.data]
    assert titles == ["Mine"]


# --- edit re-approval -------------------------------------------------------

def test_member_edit_untrusted_reenters_pending(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="Approved", approval_state=Task.Approval.APPROVED)
    res = login(member).patch(f"/api/tasks/{t.id}", {"title": "Edited"}, format="json")
    assert res.status_code == 200
    t.refresh_from_db()
    assert t.approval_state == "pending"


def test_admin_edit_stays_live(admin, sp):
    t = make_task(sp, title="Approved")
    login(admin).patch(f"/api/tasks/{t.id}", {"title": "Edited"}, format="json")
    t.refresh_from_db()
    assert t.approval_state == "approved"


def test_member_edit_trusted_stays_live(member, sp):
    sp.members_post_without_approval = True
    sp.save()
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="Approved")
    login(member).patch(f"/api/tasks/{t.id}", {"title": "Edited"}, format="json")
    t.refresh_from_db()
    assert t.approval_state == "approved"


# --- status changes ---------------------------------------------------------

def test_assignee_can_change_status(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="T")
    t.assignees.add(member)
    res = login(member).post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json")
    assert res.status_code == 200
    t.refresh_from_db()
    assert t.status == "done"


def test_non_assignee_member_cannot_change_status(member, other, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="T")
    t.assignees.add(other)
    res = login(member).post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json")
    assert res.status_code == 403


def test_admin_can_change_any_status(admin, sp):
    t = make_task(sp, title="T")
    res = login(admin).post(f"/api/tasks/{t.id}/status", {"status": "delayed"}, format="json")
    assert res.status_code == 200


def test_invalid_status_rejected(admin, sp):
    t = make_task(sp, title="T")
    res = login(admin).post(f"/api/tasks/{t.id}/status", {"status": "banana"}, format="json")
    assert res.status_code == 400


def test_done_twice_is_consistent(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="T")
    t.assignees.add(member)
    api = login(member)
    api.post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json")
    api.post(f"/api/tasks/{t.id}/status", {"status": "done"}, format="json")
    t.refresh_from_db()
    assert t.status == "done"


# --- approval workflow ------------------------------------------------------

def test_member_cannot_approve(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = make_task(sp, title="T", approval_state=Task.Approval.PENDING)
    res = login(member).post(f"/api/tasks/{t.id}/approve", {}, format="json")
    assert res.status_code == 403


def test_admin_approve_then_double_approve_idempotent(admin, sp):
    t = make_task(sp, title="T", approval_state=Task.Approval.PENDING)
    api = login(admin)
    r1 = api.post(f"/api/tasks/{t.id}/approve", {}, format="json")
    r2 = api.post(f"/api/tasks/{t.id}/approve", {}, format="json")
    assert r1.status_code == 200 and r2.status_code == 200
    t.refresh_from_db()
    assert t.approval_state == "approved"


def test_approvals_inbox_lists_pending(admin, sp):
    make_task(sp, title="P1", approval_state=Task.Approval.PENDING)
    make_task(sp, title="A1", approval_state=Task.Approval.APPROVED)
    res = login(admin).get("/api/approvals")
    titles = [t["title"] for t in res.data]
    assert titles == ["P1"]


def test_bulk_approve(admin, sp):
    t1 = make_task(sp, title="P1", approval_state=Task.Approval.PENDING)
    t2 = make_task(sp, title="P2", approval_state=Task.Approval.PENDING)
    res = login(admin).post("/api/approvals", {"ids": [t1.id, t2.id], "action": "approve"}, format="json")
    assert res.status_code == 200
    assert set(res.data["updated"]) == {t1.id, t2.id}
    assert Task.objects.filter(approval_state="approved").count() == 2


def test_member_cannot_access_approvals_inbox(member, sp):
    res = login(member).get("/api/approvals")
    assert res.status_code == 403


# --- recurrence + links -----------------------------------------------------

def test_create_with_recurrence(admin, sp):
    res = login(admin).post(
        "/api/tasks",
        {"subproject": sp.id, "title": "Weekly",
         "recurrence": {"freq": "weekly", "interval": 1, "anchor": "2026-06-01"}},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["recurrence"]["freq"] == "weekly"


def test_recurrence_rejects_both_end_date_and_count(admin, sp):
    res = login(admin).post(
        "/api/tasks",
        {"subproject": sp.id, "title": "X",
         "recurrence": {"freq": "daily", "interval": 1, "anchor": "2026-06-01",
                        "end_date": "2026-12-01", "count": 5}},
        format="json",
    )
    assert res.status_code == 400


def test_links_must_be_list_of_strings(admin, sp):
    res = login(admin).post("/api/tasks", {"subproject": sp.id, "title": "X", "links": "nope"}, format="json")
    assert res.status_code == 400


# --- assignee_group filter (group → members) --------------------------------

def test_filter_by_assignee_group_includes_members_and_direct(admin, member, other, sp):
    from accounts.models import Group
    g = Group.objects.create(name="Seva")
    g.members.add(member)
    t_member = Task.objects.create(subproject=sp, title="member task")
    t_member.assignees.add(member)              # via group membership
    t_direct = Task.objects.create(subproject=sp, title="group task")
    t_direct.assignee_groups.add(g)             # assigned to the group directly
    Task.objects.create(subproject=sp, title="unrelated")
    t_other = Task.objects.create(subproject=sp, title="other task")
    t_other.assignees.add(other)                # not in the group

    res = login(admin).get(f"/api/tasks?assignee_group={g.id}")
    titles = {t["title"] for t in res.data}
    assert titles == {"member task", "group task"}


def test_me_exposes_group_names(admin):
    from accounts.models import Group
    Group.objects.create(name="Kitchen")
    data = login(admin).get("/api/me").data
    assert "groups" in data and any(g["name"] == "Kitchen" for g in data["groups"])
    # names only — no membership leaked
    assert all(set(g.keys()) == {"id", "name"} for g in data["groups"])
