"""Restore points: snapshot, restore (with auto-save-before), retention, API."""

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import RestorePoint, Task
import restore_service as rs


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


def test_save_and_restore_roundtrip(db):
    p = Project.objects.create(name="Karuna")
    sp = SubProject.objects.create(project=p, name="Marketing")
    Task.objects.create(subproject=sp, title="Flyer")
    point = rs.save_point("snap1", auto=False)
    assert point.stats["tasks"] == 1 and point.stats["projects"] == 1

    # mutate the board
    Task.objects.create(subproject=sp, title="Extra")
    Project.objects.create(name="Later")
    assert Task.objects.count() == 2 and Project.objects.count() == 2

    rs.restore_point(point)
    # back to the snapshot state
    assert Task.objects.count() == 1
    assert Project.objects.filter(name="Karuna").exists()
    assert not Project.objects.filter(name="Later").exists()
    assert Task.objects.filter(title="Flyer").exists()


def test_restore_roundtrips_grants_sees_and_exclusions(db):
    from accounts.models import Tier, User
    from permissions.models import AccessGrant, Exclusion

    p = Project.objects.create(name="Karuna")
    sp = SubProject.objects.create(project=p, name="Marketing")
    t = Task.objects.create(subproject=sp, title="Flyer")
    member = User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")
    tier = Tier.objects.create(name="Volunteer", default_sees="own")
    member.tier = tier
    member.save(update_fields=["tier"])
    AccessGrant.objects.create(tier=tier, subproject=sp, level="member", sees="own")
    Exclusion.objects.create(user=member, excluded_task=t)

    point = rs.save_point("snap", auto=False)
    assert point.stats["exclusions"] == 1 and point.stats["tiers"] == 1

    # mutate: drop the exclusion, widen the grant
    Exclusion.objects.all().delete()
    AccessGrant.objects.update(sees="subproject")

    rs.restore_point(point)
    # exclusion came back, grant's sees breadth restored, member's tier link intact
    assert Exclusion.objects.filter(user=member, excluded_task=t).exists()
    assert AccessGrant.objects.get(tier=tier).sees == "own"
    member.refresh_from_db()
    assert member.tier_id == tier.id  # tier link survived the restore


def test_restore_autosaves_current_first(db):
    Project.objects.create(name="P1")
    snap = rs.save_point("snap", auto=False)
    before = RestorePoint.objects.count()
    rs.restore_point(snap)
    # a new auto restore-point (the pre-restore state) was created
    assert RestorePoint.objects.filter(auto=True, label__startswith="Before restore").exists()
    assert RestorePoint.objects.count() == before + 1


def test_auto_pruning_keeps_last_10(db):
    for i in range(13):
        rs.save_point(f"auto{i}", auto=True)
    assert RestorePoint.objects.filter(auto=True).count() == 10  # pruned to MAX_AUTO


def test_manual_saves_not_pruned(db):
    for i in range(5):
        rs.save_point(f"manual{i}", auto=False)
    for i in range(13):
        rs.save_point(f"auto{i}", auto=True)
    assert RestorePoint.objects.filter(auto=False).count() == 5   # manuals all kept
    assert RestorePoint.objects.filter(auto=True).count() == 10


# --- API --------------------------------------------------------------------

def test_admin_save_list_restore_delete(admin, db):
    Project.objects.create(name="Karuna")
    api = login(admin)
    created = api.post("/api/restore-points", {"label": "My save"}, format="json")
    assert created.status_code == 201
    rid = created.data["id"]
    assert created.data["stats"]["projects"] == 1

    listing = api.get("/api/restore-points")
    assert any(p["label"] == "My save" for p in listing.data)
    assert "data" not in listing.data[0]  # bulky payload not exposed in list

    Project.objects.create(name="Oops")
    api.post(f"/api/restore-points/{rid}/restore", {}, format="json")
    assert not Project.objects.filter(name="Oops").exists()  # rolled back to snapshot

    assert api.delete(f"/api/restore-points/{rid}").status_code == 204


def test_member_cannot_use_restore_points(member):
    assert login(member).get("/api/restore-points").status_code == 403
    assert login(member).post("/api/restore-points", {"label": "x"}, format="json").status_code == 403
