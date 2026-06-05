"""Platform owner (superuser) cross-org view: metadata-only stats, never task
content, and no backdoor into an org's actual data."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, Tier, User
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def api():
    return APIClient()


def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")


@pytest.fixture
def world(db):
    a = Organization.objects.create(name="Ananda LA", city="Los Angeles", country="USA", is_active=True)
    b = Organization.objects.create(name="Ananda Assisi", city="Assisi", country="Italy", is_active=True)
    pa = Project.objects.create(name="Outreach", organization=a)
    spa = SubProject.objects.create(project=pa, name="Flyers")
    Task.objects.create(subproject=spa, title="secret-task-one")
    Task.objects.create(subproject=spa, title="secret-task-two")
    admin_a = User.objects.create_user(email="admin_a@x.com", name="Hriman", password="pw-strong-123")
    Membership.objects.create(user=admin_a, organization=a, role="admin")
    tier = Tier.objects.create(organization=a, name="Coordinator")
    mem_a = User.objects.create_user(email="mem_a@x.com", name="Seva", password="pw-strong-123")
    Membership.objects.create(user=mem_a, organization=a, role="member", tier=tier)
    su = User.objects.create_superuser(email="root@x.com", name="Root", password="pw-strong-123")
    return {"a": a, "b": b, "admin_a": admin_a, "mem_a": mem_a, "su": su}


def test_superuser_sees_org_metadata_and_roster(api, world):
    auth(api, world["su"])
    res = api.get("/api/platform/orgs")
    assert res.status_code == 200
    la = {o["name"]: o for o in res.data}["Ananda LA"]
    assert la["city"] == "Los Angeles" and la["country"] == "USA"
    assert la["counts"] == {"projects": 1, "subprojects": 2, "tasks": 2, "members": 2}  # General + Flyers
    assert {a["email"] for a in la["admins"]} == {"admin_a@x.com"}
    roster = {m["email"]: m for m in la["members"]}
    assert roster["mem_a@x.com"]["role"] == "member"
    assert roster["mem_a@x.com"]["tier"] == "Coordinator"
    assert roster["admin_a@x.com"]["role"] == "admin"


def test_stats_never_expose_task_content(api, world):
    auth(api, world["su"])
    blob = str(api.get("/api/platform/orgs").data)
    assert "secret-task-one" not in blob and "secret-task-two" not in blob


def test_org_admin_cannot_access_platform_stats(api, world):
    auth(api, world["admin_a"])
    assert api.get("/api/platform/orgs").status_code == 403


def test_platform_stats_requires_auth(api, world):
    assert api.get("/api/platform/orgs").status_code == 401


def test_superuser_cannot_read_another_orgs_tasks(api, world):
    # The platform owner is not a member of org A → its tasks stay private even
    # when they target it explicitly via the org header.
    auth(api, world["su"])
    res = api.get("/api/tasks", HTTP_X_ORG_ID=str(world["a"].id))
    assert res.status_code == 200 and res.data == []
