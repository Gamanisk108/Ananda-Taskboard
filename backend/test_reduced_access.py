"""Reduced-access parity: a non-admin Member gets self-service Trash (restore
ONLY their own deletions), personal preferences, and access-scoped bulk actions.
Every rule is enforced server-side regardless of the UI."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Status, Task


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
    return SubProject.objects.create(project=Project.objects.create(name="Karuna"), name="Marketing")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def grant(user, subproject, level="member"):
    AccessGrant.objects.create(user=user, subproject=subproject, level=level)


# ── Trash: restore your own deletions ────────────────────────────────────────

def test_member_trash_lists_only_their_own_deleted_tasks(member, other, sp):
    grant(member, sp)
    grant(other, sp)
    mine = Task.objects.create(subproject=sp, title="MineDeleted")
    theirs = Task.objects.create(subproject=sp, title="TheirsDeleted")
    assert login(member).delete(f"/api/tasks/{mine.id}").status_code == 204
    assert login(other).delete(f"/api/tasks/{theirs.id}").status_code == 204

    data = login(member).get("/api/trash").data
    titles = [t["label"] for t in data["tasks"]]
    assert titles == ["MineDeleted"]              # only their own
    assert data["projects"] == [] and data["subprojects"] == []  # never project/sub-project trash


def test_member_can_restore_own_task_but_not_anothers(member, other, sp):
    grant(member, sp)
    grant(other, sp)
    mine = Task.objects.create(subproject=sp, title="Mine")
    theirs = Task.objects.create(subproject=sp, title="Theirs")
    login(member).delete(f"/api/tasks/{mine.id}")
    login(other).delete(f"/api/tasks/{theirs.id}")

    api = login(member)
    assert api.post("/api/trash/action", {"type": "task", "id": mine.id}, format="json").status_code == 200
    assert Task.objects.filter(pk=mine.id).exists()  # live again

    forbidden = api.post("/api/trash/action", {"type": "task", "id": theirs.id}, format="json")
    assert forbidden.status_code == 403
    assert not Task.objects.filter(pk=theirs.id).exists()  # still trashed


def test_member_cannot_purge_anothers_task(member, other, sp):
    grant(member, sp)
    grant(other, sp)
    theirs = Task.objects.create(subproject=sp, title="Theirs")
    login(other).delete(f"/api/tasks/{theirs.id}")
    r = login(member).delete("/api/trash/action", {"type": "task", "id": theirs.id}, format="json")
    assert r.status_code == 403
    assert Task.all_objects.filter(pk=theirs.id).exists()  # not hard-deleted


def test_member_cannot_restore_project_or_subproject(admin, member, sp):
    from trashbin import soft_delete_project
    grant(member, sp)
    proj = sp.project
    soft_delete_project(proj, by=admin)  # admin-cascade delete
    api = login(member)
    assert api.post("/api/trash/action", {"type": "project", "id": proj.id}, format="json").status_code == 403
    assert api.post("/api/trash/action", {"type": "subproject", "id": sp.id}, format="json").status_code == 403


def test_admin_trash_sees_member_deletions(admin, member, sp):
    grant(member, sp)
    t = Task.objects.create(subproject=sp, title="MemberDeleted")
    login(member).delete(f"/api/tasks/{t.id}")
    data = login(admin).get("/api/trash").data
    assert any(x["label"] == "MemberDeleted" for x in data["tasks"])


def test_restore_clears_deleted_by(member, sp):
    grant(member, sp)
    t = Task.objects.create(subproject=sp, title="X")
    login(member).delete(f"/api/tasks/{t.id}")
    assert Task.all_objects.get(pk=t.id).deleted_by_id == member.id
    login(member).post("/api/trash/action", {"type": "task", "id": t.id}, format="json")
    assert Task.objects.get(pk=t.id).deleted_by_id is None


# ── Personal settings ────────────────────────────────────────────────────────

def test_member_updates_own_preferences(member):
    r = login(member).patch(
        "/api/me", {"theme": "dark", "daily_push_enabled": False, "language": "es"}, format="json"
    )
    assert r.status_code == 200
    assert r.data["theme"] == "dark"
    assert r.data["daily_push_enabled"] is False
    assert r.data["language"] == "es"
    member.refresh_from_db()
    assert member.theme == "dark" and member.daily_push_enabled is False


def test_member_cannot_touch_app_settings(member):
    # App-wide settings stay admin-only.
    assert login(member).get("/api/settings").status_code == 403


def test_daily_push_respects_personal_opt_out(member, sp):
    from notifications.daily import local_today, run_daily_push
    grant(member, sp)
    t = Task.objects.create(subproject=sp, title="DueToday", deadline=local_today())
    t.assignees.add(member)

    member.daily_push_enabled = False
    member.save(update_fields=["daily_push_enabled"])
    assert run_daily_push(send=False)["recipients"] == 0

    member.daily_push_enabled = True
    member.save(update_fields=["daily_push_enabled"])
    assert run_daily_push(send=False)["recipients"] == 1


# ── Bulk actions, access-scoped ──────────────────────────────────────────────

def _two_status_keys():
    """A (start, target) pair of distinct seeded status keys so a change is observable."""
    keys = list(Status.objects.values_list("key", flat=True)[:2])
    assert len(keys) >= 2, "expected ≥2 seeded statuses"
    return keys[0], keys[1]


def test_member_bulk_status_applies_to_accessible_skips_rest(member, sp):
    grant(member, sp)
    hidden = SubProject.objects.create(project=Project.objects.create(name="H"), name="Hidden")
    start, target = _two_status_keys()
    mine = Task.objects.create(subproject=sp, title="Mine", status=start)
    notmine = Task.objects.create(subproject=hidden, title="NotMine", status=start)

    r = login(member).post(
        "/api/tasks/bulk", {"ids": [mine.id, notmine.id], "action": "status", "value": target}, format="json"
    )
    assert r.status_code == 200
    assert r.data["updated"] == 1 and r.data["skipped"] == 1
    mine.refresh_from_db(); notmine.refresh_from_db()
    assert mine.status == target            # editable task changed
    assert notmine.status == start          # inaccessible task untouched


def test_member_bulk_viewer_level_is_skipped(member, sp):
    # Viewer access (no edit) → can't bulk-edit, counted as skipped.
    grant(member, sp, level="viewer")
    _, target = _two_status_keys()
    t = Task.objects.create(subproject=sp, title="ReadOnly")
    r = login(member).post("/api/tasks/bulk", {"ids": [t.id], "action": "status", "value": target}, format="json")
    assert r.status_code == 200
    assert r.data["updated"] == 0 and r.data["skipped"] == 1


@pytest.mark.parametrize("action,value", [("archive", None), ("move", None), ("assign", [])])
def test_member_bulk_destructive_actions_forbidden(member, sp, action, value):
    grant(member, sp)
    t = Task.objects.create(subproject=sp, title="X")
    r = login(member).post("/api/tasks/bulk", {"ids": [t.id], "action": action, "value": value}, format="json")
    assert r.status_code == 403


def test_admin_bulk_unaffected(admin, sp):
    t = Task.objects.create(subproject=sp, title="X")
    r = login(admin).post("/api/tasks/bulk", {"ids": [t.id], "action": "archive"}, format="json")
    assert r.status_code == 200 and r.data["updated"] == 1
