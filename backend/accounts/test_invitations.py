"""Org invitations: create/list/revoke (admin, org-scoped), token-gated preview +
accept for both existing accounts and brand-new invitees, expiry, isolation, and
localized invite/reset emails."""

from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invitation, Membership, Organization, User

PW = "pw-strong-123"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda LA", is_active=True)


@pytest.fixture
def admin(org):
    u = User.objects.create_user(email="admin@x.com", name="Ada", password=PW)
    Membership.objects.create(user=u, organization=org, role="admin")
    return u


def client(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": PW}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def h(org):
    return {"HTTP_X_ORG_ID": str(org.id)}


# --- create / permissions -------------------------------------------------

def test_admin_creates_invite_and_emails_new_person(admin, org):
    api = client(admin)
    r = api.post("/api/invitations", {"email": "New@Person.com", "role": "member"}, format="json", **h(org))
    assert r.status_code == 201
    inv = Invitation.objects.get()
    assert inv.email == "new@person.com" and inv.status == "pending" and inv.organization_id == org.id
    assert len(mail.outbox) == 1
    body = mail.outbox[0].body
    assert f"?invite={inv.id}" in body and f"token={inv.token}" in body


def test_member_cannot_invite(org):
    m = User.objects.create_user(email="m@x.com", name="M", password=PW)
    Membership.objects.create(user=m, organization=org, role="member")
    assert client(m).post("/api/invitations", {"email": "x@y.com"}, format="json", **h(org)).status_code == 403


def test_cannot_invite_existing_member(admin, org):
    existing = User.objects.create_user(email="member@x.com", name="Mem", password=PW)
    Membership.objects.create(user=existing, organization=org, role="member")
    assert client(admin).post("/api/invitations", {"email": "member@x.com"}, format="json", **h(org)).status_code == 400


def test_reinvite_updates_pending_no_duplicate(admin, org):
    api = client(admin)
    api.post("/api/invitations", {"email": "dup@x.com", "role": "member"}, format="json", **h(org))
    first = Invitation.objects.get(email="dup@x.com").token
    api.post("/api/invitations", {"email": "dup@x.com", "role": "admin"}, format="json", **h(org))
    invs = Invitation.objects.filter(email="dup@x.com", status="pending")
    assert invs.count() == 1 and invs.first().role == "admin" and invs.first().token != first


# --- accept: new account --------------------------------------------------

def test_accept_new_account_creates_active_user_membership_and_logs_in(admin, org):
    client(admin).post("/api/invitations", {"email": "fresh@x.com", "role": "member"}, format="json", **h(org))
    inv = Invitation.objects.get(email="fresh@x.com")
    pub = APIClient()
    prev = pub.get(f"/api/invitations/{inv.id}/preview?token={inv.token}")
    assert prev.status_code == 200 and prev.data["account_exists"] is False and prev.data["organization"] == org.name
    acc = pub.post(f"/api/invitations/{inv.id}/accept",
                   {"token": inv.token, "name": "Fresh", "password": "fresh-pw-12345"}, format="json")
    assert acc.status_code == 200 and acc.data["account_exists"] is False and "access" in acc.data
    u = User.objects.get(email="fresh@x.com")
    assert u.is_active and Membership.objects.filter(user=u, organization=org, role="member").exists()
    inv.refresh_from_db()
    assert inv.status == "accepted"
    assert APIClient().post("/api/auth/login", {"email": "fresh@x.com", "password": "fresh-pw-12345"},
                            format="json").status_code == 200


def test_invite_as_admin_yields_admin_membership(admin, org):
    client(admin).post("/api/invitations", {"email": "coadmin@x.com", "role": "admin"}, format="json", **h(org))
    inv = Invitation.objects.get(email="coadmin@x.com")
    APIClient().post(f"/api/invitations/{inv.id}/accept",
                     {"token": inv.token, "name": "Co", "password": "co-pw-123456"}, format="json")
    assert Membership.objects.get(user__email="coadmin@x.com", organization=org).role == "admin"


# --- accept: existing account (+ localized email) -------------------------

def test_accept_existing_account_joins_without_tokens_and_email_is_localized(admin, org):
    existing = User.objects.create_user(email="known@x.com", name="Known", password=PW, language="es")
    client(admin).post("/api/invitations", {"email": "known@x.com", "role": "member"}, format="json", **h(org))
    assert "Te invitan" in mail.outbox[-1].subject  # Spanish (recipient's language)
    inv = Invitation.objects.get(email="known@x.com")
    pub = APIClient()
    assert pub.get(f"/api/invitations/{inv.id}/preview?token={inv.token}").data["account_exists"] is True
    acc = pub.post(f"/api/invitations/{inv.id}/accept", {"token": inv.token}, format="json")
    assert acc.status_code == 200 and acc.data["account_exists"] is True and "access" not in acc.data
    assert Membership.objects.filter(user=existing, organization=org).exists()


# --- token / expiry / revoke ----------------------------------------------

def test_accept_rejects_bad_token(admin, org):
    client(admin).post("/api/invitations", {"email": "a@b.com"}, format="json", **h(org))
    inv = Invitation.objects.get()
    r = APIClient().post(f"/api/invitations/{inv.id}/accept",
                         {"token": "nope", "name": "X", "password": "x-pw-123456"}, format="json")
    assert r.status_code == 400


def test_expired_invite_is_invalid(admin, org):
    client(admin).post("/api/invitations", {"email": "old@x.com"}, format="json", **h(org))
    inv = Invitation.objects.get()
    Invitation.objects.filter(pk=inv.pk).update(created_at=timezone.now() - timedelta(days=30))
    assert APIClient().get(f"/api/invitations/{inv.id}/preview?token={inv.token}").status_code == 400


def test_revoke_makes_invite_invalid(admin, org):
    api = client(admin)
    api.post("/api/invitations", {"email": "rev@x.com"}, format="json", **h(org))
    inv = Invitation.objects.get()
    assert api.delete(f"/api/invitations/{inv.id}", **h(org)).status_code in (200, 204)
    inv.refresh_from_db()
    assert inv.status == "revoked"
    assert APIClient().get(f"/api/invitations/{inv.id}/preview?token={inv.token}").status_code == 400


# --- isolation -------------------------------------------------------------

def test_invitation_list_is_org_scoped(admin, org):
    other = Organization.objects.create(name="Other", is_active=True)
    Invitation.objects.create(organization=other, email="x@other.com", token="t1")
    api = client(admin)
    api.post("/api/invitations", {"email": "mine@x.com"}, format="json", **h(org))
    emails = {i["email"] for i in api.get("/api/invitations", **h(org)).data}
    assert "mine@x.com" in emails and "x@other.com" not in emails


def test_reset_email_is_localized(db):
    User.objects.create_user(email="fr@x.com", name="Fred", password=PW, language="fr")
    APIClient().post("/api/auth/password/request", {"email": "fr@x.com"}, format="json")
    assert "Réinitialisez" in mail.outbox[-1].subject
