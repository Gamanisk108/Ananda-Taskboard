"""Tests for share-preview cards: token minting, OG unfurl, card rendering,
description toggle, revoke (410), permission + tenant gates, soft-delete, ETag."""

import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from projects.models import Project, SubProject
from sharing.models import ShareLink
from tasks.models import Subtask, Task


# ── fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda Portland", country="USA", is_active=True)


@pytest.fixture
def admin(org):
    u = User.objects.create_user(email="a@example.com", name="Ada Admin", password="pw-strong-123")
    Membership.objects.create(user=u, organization=org, role="admin")
    return u


@pytest.fixture
def project(org):
    return Project.objects.create(organization=org, name="Sunday Service")


@pytest.fixture
def subproject(project):
    return SubProject.objects.create(project=project, name="Choir & Music")


@pytest.fixture
def task(subproject):
    return Task.objects.create(
        subproject=subproject, title="Fix the glitchy overlay", details="Repro on Safari iOS.",
        priority=5, status="in_progress",
    )


@pytest.fixture
def subtask(task):
    return Subtask.objects.create(task=task, title="Investigate text block", priority=2, status="review")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def make_link(api, org, type_, obj_id):
    return api.post("/api/share", {"type": type_, "id": obj_id}, format="json", HTTP_X_ORG_ID=str(org.id))


# ── minting ─────────────────────────────────────────────────────────────────

def test_mint_returns_token_and_url(admin, org, task):
    api = login(admin)
    res = make_link(api, org, "task", task.id)
    assert res.status_code == 200
    body = res.data
    assert body["type"] == "task" and body["object_id"] == task.id
    assert len(body["token"]) >= 20 and f"/s/{body['token']}" in body["url"]
    assert body["include_description"] is True
    assert body["deep_link"] == f"/?task={task.id}"


def test_mint_is_idempotent(admin, org, task):
    api = login(admin)
    a = make_link(api, org, "task", task.id).data["token"]
    b = make_link(api, org, "task", task.id).data["token"]
    assert a == b
    assert ShareLink.objects.filter(object_id=task.id, revoked_at__isnull=True).count() == 1


def test_token_is_unguessable_and_unique(admin, org, task, subproject):
    api = login(admin)
    t1 = make_link(api, org, "task", task.id).data["token"]
    t2 = make_link(api, org, "subproject", subproject.id).data["token"]
    assert t1 != t2 and "/" not in t1 and "/" not in t2  # url-safe, no path chars


@pytest.mark.parametrize("type_,fixture", [("project", "project"), ("subproject", "subproject"),
                                           ("task", "task"), ("subtask", "subtask")])
def test_every_entity_type_is_shareable(admin, org, request, type_, fixture):
    obj = request.getfixturevalue(fixture)
    api = login(admin)
    res = make_link(api, org, type_, obj.id)
    assert res.status_code == 200, res.data


# ── public unfurl + card ──────────────────────────────────────────────────────

def test_landing_carries_og_tags(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    html = APIClient().get(f"/s/{token}").content.decode()
    assert 'property="og:title"' in html and task.title in html
    assert f"/s/{token}/card.png" in html
    assert 'name="twitter:card" content="summary_large_image"' in html
    assert f"/?task={task.id}" in html  # deep link present


@pytest.fixture
def rich_task(subproject, admin):
    import datetime
    t = Task.objects.create(
        subproject=subproject, title="Consolidate media", details="Scatter across drives.",
        requirements="Keep originals.", priority=3, status="todo",
        deadline=datetime.date(2026, 7, 15), timeline_start=datetime.date(2026, 6, 19),
        links=["https://drive.example/x", "javascript:alert(1)", "https://ananda.org"],
    )
    t.assignees.add(admin)
    Subtask.objects.create(task=t, title="Audit folders", status="done", priority=2, order=0)
    Subtask.objects.create(task=t, title="Define structure", status="in_progress", priority=4, order=1)
    return t


def test_landing_is_full_readonly_view(admin, org, rich_task):
    token = make_link(login(admin), org, "task", rich_task.id).data["token"]
    html = APIClient().get(f"/s/{token}").content.decode()
    # Full task content is shown as text…
    assert "Scatter across drives." in html          # description
    assert "Keep originals." in html                 # requirements
    assert "Audit folders" in html and "Define structure" in html  # subtasks
    assert "Jul 15, 2026" in html                    # deadline
    assert "https://drive.example/x" in html         # http link rendered
    # …with NO editable fields and NO comments/attachments.
    assert "<input" not in html and "<textarea" not in html and "<select" not in html
    assert "comment" not in html.lower() and "attachment" not in html.lower()


def test_landing_filters_non_http_links(admin, org, rich_task):
    token = make_link(login(admin), org, "task", rich_task.id).data["token"]
    html = APIClient().get(f"/s/{token}").content.decode()
    assert "javascript:alert" not in html  # only http(s) hrefs on a public page


def test_description_toggle_hides_body_keeps_structure(admin, org, rich_task):
    api = login(admin)
    token = make_link(api, org, "task", rich_task.id).data["token"]
    api.patch(f"/api/share/{token}", {"include_description": False}, format="json", HTTP_X_ORG_ID=str(org.id))
    html = APIClient().get(f"/s/{token}").content.decode()
    assert "Scatter across drives." not in html and "Keep originals." not in html  # body hidden
    assert "Audit folders" in html  # structured subtasks still shown


def test_card_png_renders(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    res = APIClient().get(f"/s/{token}/card.png")
    assert res.status_code == 200 and res["Content-Type"] == "image/png"
    assert res.content[:8] == b"\x89PNG\r\n\x1a\n" and len(res.content) > 2000


def test_card_etag_304(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    first = APIClient().get(f"/s/{token}/card.png")
    etag = first["ETag"]
    again = APIClient().get(f"/s/{token}/card.png", HTTP_IF_NONE_MATCH=etag)
    assert again.status_code == 304


def test_unknown_token_is_410(db):
    assert APIClient().get("/s/does-not-exist").status_code == 410
    assert APIClient().get("/s/does-not-exist/card.png").status_code == 410


# ── description toggle ────────────────────────────────────────────────────────

def test_description_toggle_suppresses_excerpt(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    assert "Repro on Safari iOS" in APIClient().get(f"/s/{token}").content.decode()
    api.patch(f"/api/share/{token}", {"include_description": False}, format="json", HTTP_X_ORG_ID=str(org.id))
    html = APIClient().get(f"/s/{token}").content.decode()
    assert "Repro on Safari iOS" not in html
    # Card still renders fine with description suppressed.
    assert APIClient().get(f"/s/{token}/card.png").status_code == 200


# ── revoke ────────────────────────────────────────────────────────────────────

def test_revoke_makes_link_gone(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    assert api.post(f"/api/share/{token}/revoke", HTTP_X_ORG_ID=str(org.id)).status_code == 204
    assert APIClient().get(f"/s/{token}").status_code == 410
    assert APIClient().get(f"/s/{token}/card.png").status_code == 410


def test_resharing_after_revoke_mints_new_token(admin, org, task):
    api = login(admin)
    t1 = make_link(api, org, "task", task.id).data["token"]
    api.post(f"/api/share/{t1}/revoke", HTTP_X_ORG_ID=str(org.id))
    t2 = make_link(api, org, "task", task.id).data["token"]
    assert t2 != t1


# ── permission + tenant gates ─────────────────────────────────────────────────

def test_no_org_context_is_rejected(admin, task):
    api = login(admin)
    res = api.post("/api/share", {"type": "task", "id": task.id}, format="json")  # no X-Org-Id
    assert res.status_code == 400


def test_cross_org_user_cannot_share(db, org, task):
    other = Organization.objects.create(name="Ananda Assisi", country="Italy", is_active=True)
    intruder = User.objects.create_user(email="b@example.com", name="Bo", password="pw-strong-123")
    Membership.objects.create(user=intruder, organization=other, role="admin")
    api = login(intruder)
    # Even pointing at the victim org id, intruder has no membership there.
    res = make_link(api, org, "task", task.id)
    assert res.status_code in (403, 404)


def test_wrong_org_manage_is_404_not_oracle(admin, org, task):
    # Mint in org A.
    token = make_link(login(admin), org, "task", task.id).data["token"]
    # A user whose ACTIVE org is a different org B must get 404 (same as an
    # unknown token) — never a 403 that would confirm the token exists elsewhere.
    other = Organization.objects.create(name="Ananda Assisi", country="Italy", is_active=True)
    outsider = User.objects.create_user(email="o@example.com", name="Odo", password="pw-strong-123")
    Membership.objects.create(user=outsider, organization=other, role="admin")
    api = login(outsider)
    assert api.patch(f"/api/share/{token}", {"include_description": False}, format="json",
                     HTTP_X_ORG_ID=str(other.id)).status_code == 404
    assert api.post(f"/api/share/{token}/revoke", HTTP_X_ORG_ID=str(other.id)).status_code == 404


def test_non_creator_member_cannot_revoke(admin, org, task):
    # Admin mints the link.
    token = make_link(login(admin), org, "task", task.id).data["token"]
    # A plain member (not admin, not creator) tries to revoke.
    member = User.objects.create_user(email="m@example.com", name="Mo", password="pw-strong-123")
    Membership.objects.create(user=member, organization=org, role="member")
    res = login(member).post(f"/api/share/{token}/revoke", HTTP_X_ORG_ID=str(org.id))
    assert res.status_code == 403


# ── soft-delete ────────────────────────────────────────────────────────────────

@override_settings(SHARE_CARD_RATE_LIMIT=3)
def test_public_routes_are_rate_limited(admin, org, task):
    cache.clear()
    token = make_link(login(admin), org, "task", task.id).data["token"]
    ip = {"HTTP_X_FORWARDED_FOR": "203.0.113.7"}
    anon = APIClient()
    codes = [anon.get(f"/s/{token}/card.png", **ip).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200]  # within the window
    assert 429 in codes[3:]              # then throttled
    # A different IP is unaffected (per-IP bucket).
    assert anon.get(f"/s/{token}/card.png", HTTP_X_FORWARDED_FOR="198.51.100.9").status_code == 200
    cache.clear()


def test_mint_invalid_id_is_400(admin, org):
    res = login(admin).post("/api/share", {"type": "task", "id": "not-an-int"},
                            format="json", HTTP_X_ORG_ID=str(org.id))
    assert res.status_code == 400


def test_mint_other_orgs_object_is_404_not_oracle(db, org, task):
    # Intruder acting in their OWN org tries to mint a link for a victim-org task
    # -> uniform 404 (not 403), so the response can't confirm the object exists.
    other = Organization.objects.create(name="Ananda Assisi", country="Italy", is_active=True)
    intruder = User.objects.create_user(email="i@example.com", name="Iva", password="pw-strong-123")
    Membership.objects.create(user=intruder, organization=other, role="admin")
    res = login(intruder).post("/api/share", {"type": "task", "id": task.id},
                               format="json", HTTP_X_ORG_ID=str(other.id))
    assert res.status_code == 404


def test_patch_non_boolean_description_is_400(admin, org, task):
    api = login(admin)
    token = make_link(api, org, "task", task.id).data["token"]
    res = api.patch(f"/api/share/{token}", {"include_description": "false"},
                    format="json", HTTP_X_ORG_ID=str(org.id))
    assert res.status_code == 400  # bool("false") would be True -> must reject


def test_card_survives_malformed_accent_color(admin, org, subproject, task):
    # A stray non-hex color must fall back, never 500 the public card.
    subproject.color = "not-a-hex"
    subproject.save(update_fields=["color"])
    token = make_link(login(admin), org, "task", task.id).data["token"]
    assert APIClient().get(f"/s/{token}/card.png").status_code == 200


def test_unnamed_assignee_shows_someone_not_email(admin, org, task):
    # Assert on the RENDERED public page, not just describe() — a regression in
    # detail()/the template could still leak the email on /s/<token>.
    nameless = User.objects.create_user(email="secret.person@example.com", name="", password="pw-strong-123")
    task.assignees.set([nameless])
    token = make_link(login(admin), org, "task", task.id).data["token"]
    html = APIClient().get(f"/s/{token}").content.decode()
    assert "Someone" in html
    assert "secret.person" not in html and "example.com" not in html


def test_soft_deleted_target_is_410(admin, org, task):
    token = make_link(login(admin), org, "task", task.id).data["token"]
    task.delete()  # soft delete
    assert APIClient().get(f"/s/{token}").status_code == 410
    assert APIClient().get(f"/s/{token}/card.png").status_code == 410
