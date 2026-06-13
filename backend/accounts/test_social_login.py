"""Google sign-in / sign-up + create-org + org-creator-is-owner. The Google ID-token
verification is mocked — these test our linking/creation/JWT/org logic, not Google's
crypto."""

import google.oauth2.id_token as idt
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User

PW = "pw-strong-123"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


def _token(monkeypatch, *, email="neo@example.com", name="Neo", verified=True, iss="accounts.google.com"):
    monkeypatch.setattr(idt, "verify_oauth2_token", lambda *a, **k: {
        "iss": iss, "email": email, "email_verified": verified, "name": name, "sub": "g-123",
    })


@override_settings(GOOGLE_CLIENT_ID="")
def test_503_when_unconfigured(db):
    r = APIClient().post("/api/auth/google", {"credential": "x"}, format="json")
    assert r.status_code == 503


@override_settings(GOOGLE_CLIENT_ID="test-client")
def test_new_google_user_created_and_needs_org(db, monkeypatch):
    _token(monkeypatch, email="New@Person.com")
    r = APIClient().post("/api/auth/google", {"credential": "tok"}, format="json")
    assert r.status_code == 200
    assert r.data["created"] is True and r.data["needs_org"] is True
    assert r.data["access"] and r.data["refresh"]
    u = User.objects.get(email="new@person.com")        # normalized lowercase
    assert u.is_active and not u.has_usable_password()


@override_settings(GOOGLE_CLIENT_ID="test-client")
def test_existing_account_logs_in(db, monkeypatch):
    u = User.objects.create_user(email="ada@x.com", name="Ada", password=PW)
    org = Organization.objects.create(name="Ada Org", is_active=True)
    Membership.objects.create(user=u, organization=org, role=Membership.Role.OWNER)
    _token(monkeypatch, email="ada@x.com")
    r = APIClient().post("/api/auth/google", {"credential": "tok"}, format="json")
    assert r.status_code == 200
    assert r.data["created"] is False and r.data["needs_org"] is False
    assert User.objects.filter(email="ada@x.com").count() == 1   # no duplicate


@override_settings(GOOGLE_CLIENT_ID="test-client")
def test_unverified_email_rejected(db, monkeypatch):
    _token(monkeypatch, verified=False)
    assert APIClient().post("/api/auth/google", {"credential": "tok"}, format="json").status_code == 401


@override_settings(GOOGLE_CLIENT_ID="test-client")
def test_bad_token_rejected(db, monkeypatch):
    def boom(*a, **k):
        raise ValueError("bad token")
    monkeypatch.setattr(idt, "verify_oauth2_token", boom)
    assert APIClient().post("/api/auth/google", {"credential": "tok"}, format="json").status_code == 401


@override_settings(GOOGLE_CLIENT_ID="test-client")
def test_create_org_after_social_signup(db, monkeypatch):
    _token(monkeypatch, email="founder@x.com")
    api = APIClient()
    r = api.post("/api/auth/google", {"credential": "tok"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    cr = api.post("/api/orgs", {"organization": "New Center"}, format="json")
    assert cr.status_code == 201
    user = User.objects.get(email="founder@x.com")
    m = Membership.objects.get(user=user)
    assert m.role == Membership.Role.OWNER and m.is_active and m.organization.is_active   # creator owns it
    # default tiers seeded
    assert m.organization.tiers.count() >= 4


def test_signup_creator_is_owner(db):
    r = APIClient().post("/api/auth/signup", {
        "organization": "Owned Org", "name": "Olive", "email": "olive@x.com", "password": PW,
    }, format="json")
    assert r.status_code == 201
    m = Membership.objects.get(user__email="olive@x.com")
    assert m.role == Membership.Role.OWNER     # was admin before the owner-role fix
