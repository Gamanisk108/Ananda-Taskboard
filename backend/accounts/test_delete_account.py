"""Self-service account deletion (store-readiness Phase 1, 2026-06-10)."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def api():
    return APIClient()


def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    assert res.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")


@pytest.fixture
def world(db):
    org = Organization.objects.create(name="Ananda LA", is_active=True)
    admin = User.objects.create_user(email="a@x.com", name="Ada", password="pw-strong-123")
    admin2 = User.objects.create_user(email="a2@x.com", name="Bea", password="pw-strong-123")
    member = User.objects.create_user(email="m@x.com", name="Mia", password="pw-strong-123")
    Membership.objects.create(user=admin, organization=org, role="admin")
    Membership.objects.create(user=admin2, organization=org, role="admin")
    Membership.objects.create(user=member, organization=org, role="member")
    proj = Project.objects.create(organization=org, name="P")
    sub = SubProject.objects.create(project=proj, name="S")
    task = Task.objects.create(subproject=sub, title="Shared work", created_by=member)
    return {"org": org, "admin": admin, "admin2": admin2, "member": member, "task": task}


def test_member_can_delete_their_account(api, world):
    auth(api, world["member"])
    res = api.post("/api/me/delete", {"password": "pw-strong-123"}, format="json")
    assert res.status_code == 200
    assert not User.objects.filter(email="m@x.com").exists()
    # Shared content survives, disassociated (created_by SET_NULL).
    world["task"].refresh_from_db()
    assert world["task"].created_by is None


def test_wrong_password_is_rejected(api, world):
    auth(api, world["member"])
    res = api.post("/api/me/delete", {"password": "nope"}, format="json")
    assert res.status_code == 400
    assert User.objects.filter(email="m@x.com").exists()


def test_sole_admin_with_other_members_is_blocked(api, world):
    # Remove the second admin so 'admin' is the only one left.
    Membership.objects.filter(user=world["admin2"]).update(role="member")
    auth(api, world["admin"])
    res = api.post("/api/me/delete", {"password": "pw-strong-123"}, format="json")
    assert res.status_code == 400
    assert "only admin" in str(res.data)
    assert User.objects.filter(email="a@x.com").exists()


def test_admin_with_a_co_admin_can_delete(api, world):
    auth(api, world["admin"])
    res = api.post("/api/me/delete", {"password": "pw-strong-123"}, format="json")
    assert res.status_code == 200
    assert not User.objects.filter(email="a@x.com").exists()


def test_superuser_cannot_self_delete(api, world, django_user_model):
    su = django_user_model.objects.create_superuser(email="root@x.com", name="Root", password="pw-strong-123")
    auth(api, su)
    res = api.post("/api/me/delete", {"password": "pw-strong-123"}, format="json")
    assert res.status_code == 400
    assert django_user_model.objects.filter(email="root@x.com").exists()
