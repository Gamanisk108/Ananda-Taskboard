"""API-key auth + management tests.

Covers the security-critical properties:
  - a valid key authenticates and is scoped to ITS org (creator's access)
  - org binding comes from the KEY, never a spoofable X-Org-Id header
  - read-only keys are blocked from writes (403); read_write keys may write
  - invalid / revoked / expired keys are rejected (401)
  - management (create/list/revoke) is admin-only AND JWT-only (no key can
    mint or revoke keys)
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, Tier, User
from apikeys.models import DISPLAY_PREFIX_LEN, KEY_PREFIX, ApiKey, hash_key
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task

PW = "pw-strong-123"


def build_org(tag):
    org = Organization.objects.create(name=f"{tag}-Org", country="X", is_active=True)
    proj = Project.objects.create(name=f"{tag}-Proj", organization=org)
    sub = SubProject.objects.create(project=proj, name=f"{tag}-Sub")
    admin = User.objects.create_user(email=f"admin_{tag}@x.com", name=f"{tag}-Admin", password=PW)
    Membership.objects.create(user=admin, organization=org, role="admin")
    member = User.objects.create_user(email=f"member_{tag}@x.com", name=f"{tag}-Member", password=PW)
    tier = Tier.objects.create(organization=org, name=f"{tag}-Tier")
    Membership.objects.create(user=member, organization=org, role="member", tier=tier)
    AccessGrant.objects.create(user=member, subproject=sub, level="member", sees="subproject")
    task = Task.objects.create(subproject=sub, title=f"{tag}-task", approval_state="approved")
    return {"tag": tag, "org": org, "admin": admin, "member": member, "sub": sub,
            "proj": proj, "task_id": task.id}


@pytest.fixture
def worlds(db):
    return build_org("AAA"), build_org("BBB")


def jwt_client(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": PW}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def key_client(raw, header="bearer"):
    api = APIClient()
    if header == "bearer":
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
    elif header == "apikey-scheme":
        api.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    elif header == "x-api-key":
        api.credentials(HTTP_X_API_KEY=raw)
    return api


# ── model ──────────────────────────────────────────────────────────────────
def test_generate_returns_prefixed_raw_and_stores_only_a_hash(worlds):
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"],
                               name="Claude", scope=ApiKey.Scope.READ_WRITE)
    assert raw.startswith(KEY_PREFIX)
    assert key.prefix == raw[:DISPLAY_PREFIX_LEN]
    assert key.hashed_key == hash_key(raw)
    assert raw not in (key.hashed_key,)  # never store the raw
    assert key.status == "active"


def test_status_reflects_revoke_and_expiry(worlds):
    A, _ = worlds
    key, _ = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                             scope=ApiKey.Scope.READ)
    key.expires_at = timezone.now() - timedelta(seconds=1)
    assert key.is_expired and key.status == "expired"
    key.expires_at = None
    key.revoke()
    assert key.is_revoked and key.status == "revoked"


# ── authentication ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("header", ["bearer", "apikey-scheme", "x-api-key"])
def test_valid_key_authenticates_via_each_header(worlds, header):
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                               scope=ApiKey.Scope.READ)
    r = key_client(raw, header).get("/api/tasks")
    assert r.status_code == 200
    assert A["task_id"] in {t["id"] for t in r.data}


def test_no_org_header_needed_org_comes_from_key(worlds):
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                               scope=ApiKey.Scope.READ)
    # Deliberately send NO X-Org-Id — the key still resolves the org.
    r = key_client(raw).get("/api/tasks")
    assert r.status_code == 200 and A["task_id"] in {t["id"] for t in r.data}


def test_org_id_header_cannot_be_used_to_reach_another_org(worlds):
    """Anti-spoof: a key for org A + X-Org-Id:B must still only see A's data."""
    A, B = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                               scope=ApiKey.Scope.READ)
    r = key_client(raw).get("/api/tasks", HTTP_X_ORG_ID=str(B["org"].id))
    assert r.status_code == 200
    ids = {t["id"] for t in r.data}
    assert A["task_id"] in ids
    assert B["task_id"] not in ids


def test_key_acts_as_creator_scope(worlds):
    """A member-created key is scoped to the member's visibility, not the whole org."""
    A, _ = worlds
    # Second sub-project the member has NO grant on.
    other_sub = SubProject.objects.create(project=A["proj"], name="Secret")
    hidden = Task.objects.create(subproject=other_sub, title="hidden", approval_state="approved")
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["member"], name="k",
                               scope=ApiKey.Scope.READ)
    ids = {t["id"] for t in key_client(raw).get("/api/tasks").data}
    assert A["task_id"] in ids       # granted sub-project
    assert hidden.id not in ids       # ungranted sub-project stays hidden


def test_invalid_revoked_expired_keys_rejected(worlds):
    A, _ = worlds
    assert key_client(KEY_PREFIX + "totally-bogus").get("/api/tasks").status_code == 401

    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                               scope=ApiKey.Scope.READ)
    key.revoke()
    assert key_client(raw).get("/api/tasks").status_code == 401

    key2, raw2 = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k2",
                                 scope=ApiKey.Scope.READ, expires_at=timezone.now() - timedelta(seconds=1))
    assert key_client(raw2).get("/api/tasks").status_code == 401


# ── scope enforcement ────────────────────────────────────────────────────────
def test_read_only_key_blocks_writes(worlds):
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="ro",
                               scope=ApiKey.Scope.READ)
    r = key_client(raw).post("/api/projects", {"name": "Nope"}, format="json")
    assert r.status_code == 403


def test_read_write_key_allows_writes(worlds):
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="rw",
                               scope=ApiKey.Scope.READ_WRITE)
    r = key_client(raw).post("/api/projects", {"name": "Made by AI"}, format="json")
    assert r.status_code in (200, 201), r.status_code
    assert Project.objects.filter(organization=A["org"], name="Made by AI").exists()


# ── management endpoints ─────────────────────────────────────────────────────
def test_admin_can_create_key_and_secret_shown_once(worlds):
    A, _ = worlds
    api = jwt_client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    r = api.post("/api/apikeys", {"name": "Claude", "scope": "read_write"}, format="json", **h)
    assert r.status_code == 201
    assert r.data["key"].startswith(KEY_PREFIX)  # full secret returned once
    assert r.data["scope"] == "read_write"
    key_id = r.data["id"]

    # The list never re-exposes the secret.
    lst = api.get("/api/apikeys", **h)
    assert lst.status_code == 200
    row = next(x for x in lst.data if x["id"] == key_id)
    assert "key" not in row
    assert row["masked_key"].startswith(KEY_PREFIX) and "•" in row["masked_key"]


def test_member_cannot_manage_keys(worlds):
    A, _ = worlds
    api = jwt_client(A["member"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    assert api.get("/api/apikeys", **h).status_code == 403
    assert api.post("/api/apikeys", {"name": "x", "scope": "read"}, format="json", **h).status_code == 403


def test_admin_cannot_see_or_revoke_other_orgs_keys(worlds):
    A, B = worlds
    b_key, _ = ApiKey.generate(organization=B["org"], created_by=B["admin"], name="b-key",
                               scope=ApiKey.Scope.READ)
    api = jwt_client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    ids = {x["id"] for x in api.get("/api/apikeys", **h).data}
    assert b_key.id not in ids
    # IDOR: revoking B's key through A's org context is a 404.
    assert api.delete(f"/api/apikeys/{b_key.id}", **h).status_code == 404
    b_key.refresh_from_db()
    assert b_key.revoked_at is None


def test_revoke_soft_deletes(worlds):
    A, _ = worlds
    key, _ = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="k",
                             scope=ApiKey.Scope.READ)
    api = jwt_client(A["admin"])
    h = {"HTTP_X_ORG_ID": str(A["org"].id)}
    assert api.delete(f"/api/apikeys/{key.id}", **h).status_code == 204
    key.refresh_from_db()
    assert key.revoked_at is not None  # kept, not hard-deleted


def test_api_key_cannot_manage_keys(worlds):
    """Even a read_write key cannot list or mint keys — management is JWT-only."""
    A, _ = worlds
    key, raw = ApiKey.generate(organization=A["org"], created_by=A["admin"], name="rw",
                               scope=ApiKey.Scope.READ_WRITE)
    api = key_client(raw)
    assert api.get("/api/apikeys").status_code == 401
    assert api.post("/api/apikeys", {"name": "escalate", "scope": "read_write"},
                    format="json").status_code == 401
