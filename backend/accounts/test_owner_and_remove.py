"""Org Owner role + member removal + ownership transfer.

Owner = the single top authority per org (the creator by default): full admin
powers, but immune to demote/deactivate/remove by anyone else. Only the owner
can transfer ownership (which demotes them to admin). Removal detaches a user
from THIS org (deletes the Membership), never their whole account.
"""

import pytest
from rest_framework.test import APIClient

from accounts.models import Group, Membership, Organization, User

PW = "pw-strong-123"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def org(db):
    o = Organization.objects.create(name="Ananda Owner Test", is_active=True)
    return o


@pytest.fixture
def owner(org):
    u = User.objects.create_user(email="owner@x.com", name="Olive", password=PW)
    Membership.objects.create(user=u, organization=org, role="owner")
    org.created_by = u
    org.save(update_fields=["created_by"])
    return u


@pytest.fixture
def admin(org):
    u = User.objects.create_user(email="admin@x.com", name="Ada", password=PW)
    Membership.objects.create(user=u, organization=org, role="admin")
    return u


@pytest.fixture
def member(org):
    u = User.objects.create_user(email="mem@x.com", name="Mira", password=PW)
    Membership.objects.create(user=u, organization=org, role="member")
    return u


def client(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": PW}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def h(org):
    return {"HTTP_X_ORG_ID": str(org.id)}


# ── Owner authority ─────────────────────────────────────────────────────────

def test_owner_membership_is_admin(owner, org):
    m = Membership.objects.get(user=owner, organization=org)
    assert m.is_owner is True
    assert m.is_admin is True  # owner has full admin powers


def test_me_reports_is_owner(owner, org):
    r = client(owner).get("/api/me", **h(org))
    assert r.status_code == 200
    assert r.data["is_owner"] is True and r.data["is_admin"] is True


def test_users_list_marks_owner(owner, member, org):
    rows = {u["email"]: u for u in client(owner).get("/api/users", **h(org)).data}
    assert rows["owner@x.com"]["is_owner"] is True
    assert rows["owner@x.com"]["role"] == "owner"
    assert rows["mem@x.com"]["is_owner"] is False


# ── Owner is protected ──────────────────────────────────────────────────────

def test_admin_cannot_demote_owner(admin, owner, org):
    r = client(admin).patch(f"/api/users/{owner.id}", {"role": "member"}, format="json", **h(org))
    assert r.status_code == 403
    assert Membership.objects.get(user=owner, organization=org).role == "owner"


def test_admin_cannot_deactivate_or_reset_owner(admin, owner, org):
    assert client(admin).patch(f"/api/users/{owner.id}", {"is_active": False}, format="json", **h(org)).status_code == 403
    assert client(admin).patch(f"/api/users/{owner.id}", {"password": "newpw-9999"}, format="json", **h(org)).status_code == 403


def test_nobody_can_patch_role_to_owner(admin, member, org):
    r = client(admin).patch(f"/api/users/{member.id}", {"role": "owner"}, format="json", **h(org))
    assert r.status_code == 403
    assert Membership.objects.get(user=member, organization=org).role == "member"


# ── Remove a user from the org ──────────────────────────────────────────────

def test_admin_removes_member(admin, member, org):
    r = client(admin).delete(f"/api/users/{member.id}", **h(org))
    assert r.status_code == 204
    assert not Membership.objects.filter(user=member, organization=org).exists()
    assert User.objects.filter(id=member.id).exists()  # account itself survives


def test_remove_strips_org_group_membership(admin, member, org):
    g = Group.objects.create(organization=org, name="Seva")
    g.members.add(member)
    client(admin).delete(f"/api/users/{member.id}", **h(org))
    assert member.id not in set(g.members.values_list("id", flat=True))


def test_cannot_remove_owner(admin, owner, org):
    r = client(admin).delete(f"/api/users/{owner.id}", **h(org))
    assert r.status_code == 403
    assert Membership.objects.filter(user=owner, organization=org).exists()


def test_cannot_remove_self(admin, org):
    r = client(admin).delete(f"/api/users/{admin.id}", **h(org))
    assert r.status_code == 403
    assert Membership.objects.filter(user=admin, organization=org).exists()


def test_member_cannot_remove_anyone(member, admin, org):
    r = client(member).delete(f"/api/users/{admin.id}", **h(org))
    assert r.status_code == 403


def test_remove_is_org_scoped(admin, member, org):
    """Removing from org A leaves the user's membership in org B intact."""
    other = Organization.objects.create(name="Other", is_active=True)
    Membership.objects.create(user=member, organization=other, role="member")
    client(admin).delete(f"/api/users/{member.id}", **h(org))
    assert Membership.objects.filter(user=member, organization=other).exists()


# ── Transfer ownership ──────────────────────────────────────────────────────

def test_owner_transfers_ownership(owner, member, org):
    r = client(owner).post(f"/api/users/{member.id}/transfer-ownership", {}, format="json", **h(org))
    assert r.status_code == 200
    assert Membership.objects.get(user=member, organization=org).role == "owner"
    assert Membership.objects.get(user=owner, organization=org).role == "admin"  # demoted


def test_only_one_owner_after_transfer(owner, member, org):
    client(owner).post(f"/api/users/{member.id}/transfer-ownership", {}, format="json", **h(org))
    assert Membership.objects.filter(organization=org, role="owner").count() == 1


def test_admin_cannot_transfer_ownership(admin, member, owner, org):
    r = client(admin).post(f"/api/users/{member.id}/transfer-ownership", {}, format="json", **h(org))
    assert r.status_code == 403
    assert Membership.objects.get(user=owner, organization=org).role == "owner"


def test_cannot_transfer_to_non_member(owner, org):
    outsider = User.objects.create_user(email="out@x.com", name="Otto", password=PW)
    r = client(owner).post(f"/api/users/{outsider.id}/transfer-ownership", {}, format="json", **h(org))
    assert r.status_code == 400


# ── Owner succession on self-deletion ───────────────────────────────────────

def test_owner_deletion_promotes_admin_successor(owner, admin, member, org):
    r = client(owner).post("/api/me/delete", {"password": PW}, format="json", **h(org))
    assert r.status_code == 200
    # The admin (not the member) inherits ownership.
    assert Membership.objects.get(user=admin, organization=org).role == "owner"
    assert Membership.objects.filter(organization=org, role="owner").count() == 1
    assert not User.objects.filter(id=owner.id).exists()


def test_owner_deletion_promotes_member_when_no_admin(owner, member, org):
    client(owner).post("/api/me/delete", {"password": PW}, format="json", **h(org))
    assert Membership.objects.get(user=member, organization=org).role == "owner"


def test_lone_owner_can_delete_and_org_is_left_ownerless(owner, org):
    r = client(owner).post("/api/me/delete", {"password": PW}, format="json", **h(org))
    assert r.status_code == 200
    assert not Membership.objects.filter(organization=org).exists()


# ── Leave organization (self-service) ───────────────────────────────────────

def test_member_leaves_org(member, admin, org):
    r = client(member).post("/api/me/leave", {}, format="json", **h(org))
    assert r.status_code == 200
    assert not Membership.objects.filter(user=member, organization=org).exists()
    assert User.objects.filter(id=member.id).exists()  # account survives


def test_leave_is_org_scoped(member, org):
    other = Organization.objects.create(name="Other", is_active=True)
    Membership.objects.create(user=member, organization=other, role="member")
    client(member).post("/api/me/leave", {}, format="json", **h(org))
    assert not Membership.objects.filter(user=member, organization=org).exists()
    assert Membership.objects.filter(user=member, organization=other).exists()


def test_owner_leaving_promotes_successor(owner, admin, org):
    r = client(owner).post("/api/me/leave", {}, format="json", **h(org))
    assert r.status_code == 200
    assert not Membership.objects.filter(user=owner, organization=org).exists()
    assert Membership.objects.get(user=admin, organization=org).role == "owner"


def test_sole_admin_cannot_leave_with_members_remaining(admin, member, org):
    r = client(admin).post("/api/me/leave", {}, format="json", **h(org))
    assert r.status_code == 400
    assert Membership.objects.filter(user=admin, organization=org).exists()


def test_leave_strips_org_group_membership(member, org):
    g = Group.objects.create(organization=org, name="Seva")
    g.members.add(member)
    client(member).post("/api/me/leave", {}, format="json", **h(org))
    assert member.id not in set(g.members.values_list("id", flat=True))
