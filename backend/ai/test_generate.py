"""AI generate endpoint + output validation. The model call is mocked — these
test our prompt-independent guarantees: id validation against the org, priority
clamping, the daily cap, the 503-when-unconfigured gate, and the AiGeneration log.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from ai import generator
from ai.generator import _validate
from ai.models import AiGeneration, DAILY_LIMIT
from projects.models import Project, SubProject

PW = "pw-strong-123"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def org(db):
    return Organization.objects.create(name="AI Co", is_active=True)


@pytest.fixture
def admin(org):
    u = User.objects.create_user(email="a@x.com", name="Ada", password=PW)
    Membership.objects.create(user=u, organization=org, role="admin")
    return u


@pytest.fixture
def project(org):
    p = Project.objects.create(organization=org, name="Outreach")
    SubProject.objects.create(project=p, name="Flyers")
    return p


def client(user):
    api = APIClient()
    r = api.post("/api/auth/login", {"email": user.email, "password": PW}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    return api


def h(org):
    return {"HTTP_X_ORG_ID": str(org.id)}


# ── validation (pure) ────────────────────────────────────────────────────────

def _proj_fixture(project):
    return [{"id": project.id, "name": project.name,
             "subprojects": [{"id": s.id, "name": s.name} for s in project.subprojects.all()]}]


def test_validate_drops_hallucinated_ids(project):
    members = [{"id": 1, "name": "X"}]
    raw = {"tasks": [{
        "title": "Real task", "priority": 9, "project_id": 99999,
        "subproject_id": 88888, "assignee_ids": [1, 4242], "source_file_index": 50,
    }]}
    out = _validate(raw, _proj_fixture(project), members, n_files=1)["tasks"][0]
    assert out["project_id"] is None and out["subproject_id"] is None
    assert out["priority"] == 5                     # 9 clamped to 5
    assert out["assignee_ids"] == [1]               # 4242 dropped
    assert out["source_file_index"] is None         # 50 out of range


def test_validate_subtasks(project):
    raw = {"tasks": [{"title": "Big job", "subtasks": ["Step one", "  ", "Step two", 42, ""] + [f"s{i}" for i in range(30)]}]}
    out = _validate(raw, _proj_fixture(project), [], n_files=0)["tasks"][0]
    assert "Step one" in out["subtasks"] and "Step two" in out["subtasks"]
    assert "" not in out["subtasks"] and 42 not in out["subtasks"]  # blanks + non-strings dropped
    assert len(out["subtasks"]) <= 20                                # capped


def test_validate_subtasks_default_empty(project):
    out = _validate({"tasks": [{"title": "Plain"}]}, _proj_fixture(project), [], n_files=0)["tasks"][0]
    assert out["subtasks"] == []
    assert out["recurrence"] is None


def test_validate_recurrence(project):
    raw = {"tasks": [{"title": "Raja", "recurrence": {
        "freq": "weekly", "interval": 1, "weekdays": [5, 9], "count": 8, "anchor": "2026-07-11"}}]}
    r = _validate(raw, _proj_fixture(project), [], n_files=0, today="2026-06-13")["tasks"][0]["recurrence"]
    assert r["freq"] == "weekly" and r["weekdays"] == [5] and r["count"] == 8 and r["anchor"] == "2026-07-11"


def test_validate_recurrence_bad_is_none(project):
    r = _validate({"tasks": [{"title": "x", "recurrence": {"freq": "nope"}}]}, _proj_fixture(project), [], n_files=0)["tasks"][0]["recurrence"]
    assert r is None


def test_validate_recurrence_anchor_defaults_today(project):
    r = _validate({"tasks": [{"title": "x", "recurrence": {"freq": "weekly"}}]},
                  _proj_fixture(project), [], n_files=0, today="2026-06-13")["tasks"][0]["recurrence"]
    assert r["anchor"] == "2026-06-13"


def test_validate_sub_implies_project(project):
    sub = project.subprojects.first()
    out = _validate({"tasks": [{"title": "T", "subproject_id": sub.id}]},
                    _proj_fixture(project), [], n_files=0)["tasks"][0]
    assert out["subproject_id"] == sub.id and out["project_id"] == project.id


def test_validate_skips_empty_titles_and_caps(project):
    raw = {"tasks": [{"title": ""}] + [{"title": f"T{i}"} for i in range(DAILY_LIMIT + 30)]}
    res = _validate(raw, _proj_fixture(project), [], n_files=0)
    from django.conf import settings
    assert len(res["tasks"]) == settings.AI_MAX_TASKS and res["truncated"] is True


def test_validate_routes_to_existing_task(project):
    """A valid existing_task_id makes an attach row: kept + new-task fields cleared."""
    sub = project.subprojects.first()
    raw = {"tasks": [{
        "title": "Define SKU standard", "existing_task_id": 77, "priority": 5,
        "project_id": project.id, "subproject_id": sub.id, "deadline": "2026-07-01",
        "subtasks": ["Pull a QuickBooks sample", "Decide the structure"],
    }]}
    out = _validate(raw, _proj_fixture(project), [], n_files=0, existing_task_ids={77})["tasks"][0]
    assert out["existing_task_id"] == 77
    assert out["project_id"] is None and out["subproject_id"] is None   # cleared for attach
    assert out["deadline"] is None
    assert out["subtasks"] == ["Pull a QuickBooks sample", "Decide the structure"]


def test_validate_drops_hallucinated_existing_task(project):
    """An existing_task_id the user can't see → dropped; row stays a NEW task."""
    raw = {"tasks": [{"title": "New thing", "existing_task_id": 12345, "subtasks": ["a"]}]}
    out = _validate(raw, _proj_fixture(project), [], n_files=0, existing_task_ids={77})["tasks"][0]
    assert out["existing_task_id"] is None
    assert out["title"] == "New thing"


def test_validate_target_forces_routing_even_without_title(project):
    """Focused breakdown: every row attaches to the target task, titleless rows survive."""
    raw = {"tasks": [{"subtasks": ["Step A", "Step B"]}]}
    out = _validate(raw, _proj_fixture(project), [], n_files=0,
                    existing_task_ids=set(), target_task_id=55)["tasks"][0]
    assert out["existing_task_id"] == 55
    assert out["subtasks"] == ["Step A", "Step B"]


# ── endpoint ─────────────────────────────────────────────────────────────────

@override_settings(ANTHROPIC_API_KEY="")
def test_503_when_unconfigured(admin, org):
    r = client(admin).post("/api/ai/generate", {"prompt": "x"}, format="multipart", **h(org))
    assert r.status_code == 503


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_generate_happy_path(admin, org, project, monkeypatch):
    sub = project.subprojects.first()
    monkeypatch.setattr(generator, "_call_model", lambda system, blocks: {"tasks": [
        {"title": "Design flyer", "priority": 4, "project_id": project.id, "subproject_id": sub.id},
        {"title": "Book hall", "priority": 2},
    ]})
    f = SimpleUploadedFile("notes.txt", b"plan the spring event", content_type="text/plain")
    r = client(admin).post("/api/ai/generate", {"prompt": "spring event", "files": f}, format="multipart", **h(org))
    assert r.status_code == 200, r.data
    assert len(r.data["tasks"]) == 2
    assert r.data["tasks"][0]["subproject_id"] == sub.id
    assert r.data["remaining"] == DAILY_LIMIT - 1
    assert AiGeneration.objects.filter(user=admin, organization=org).count() == 1


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_generate_routes_to_existing_task(admin, org, project, monkeypatch):
    """The model routes pasted work onto a real existing task; the response carries
    the attach row + the candidate list the review UI uses."""
    from tasks.models import Task
    sub = project.subprojects.first()
    existing = Task.objects.create(subproject=sub, title="Define SKU standard", created_by=admin)
    monkeypatch.setattr(generator, "_call_model", lambda system, blocks: {"tasks": [
        {"title": "Define SKU standard", "existing_task_id": existing.id,
         "subtasks": ["Pull a QuickBooks sample", "Write the rules"]},
    ]})
    r = client(admin).post("/api/ai/generate", {"prompt": "Define SKU standard\n- pull sample\n- write rules"},
                           format="multipart", **h(org))
    assert r.status_code == 200, r.data
    assert r.data["tasks"][0]["existing_task_id"] == existing.id
    assert any(t["id"] == existing.id for t in r.data["existing_tasks"])


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_target_task_breakdown_forces_routing(admin, org, project, monkeypatch):
    """target_task_id: every returned row attaches to that one task."""
    from tasks.models import Task
    sub = project.subprojects.first()
    target = Task.objects.create(subproject=sub, title="Launch newsletter", created_by=admin)
    monkeypatch.setattr(generator, "_call_model", lambda system, blocks: {"tasks": [
        {"title": "ignored", "subtasks": ["Draft copy", "Pick send date"]},
    ]})
    r = client(admin).post("/api/ai/generate",
                           {"prompt": "draft copy; pick date", "target_task_id": str(target.id)},
                           format="multipart", **h(org))
    assert r.status_code == 200, r.data
    assert r.data["tasks"][0]["existing_task_id"] == target.id
    assert r.data["tasks"][0]["subtasks"] == ["Draft copy", "Pick send date"]


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_target_task_rejected_when_not_visible(admin, org, project, monkeypatch):
    """A target task in ANOTHER org must be refused (and the slot refunded)."""
    from tasks.models import Task
    other = Organization.objects.create(name="Other Co", is_active=True)
    op = Project.objects.create(organization=other, name="Theirs")
    osub = SubProject.objects.create(project=op, name="Sub")
    foreign = Task.objects.create(subproject=osub, title="Not yours", created_by=admin)
    monkeypatch.setattr(generator, "_call_model", lambda system, blocks: {"tasks": []})
    r = client(admin).post("/api/ai/generate",
                           {"prompt": "x", "target_task_id": str(foreign.id)},
                           format="multipart", **h(org))
    assert r.status_code == 400
    assert AiGeneration.objects.filter(user=admin, organization=org).count() == 0


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_requires_prompt_or_file(admin, org):
    r = client(admin).post("/api/ai/generate", {}, format="multipart", **h(org))
    assert r.status_code == 400


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_daily_cap_blocks(admin, org, monkeypatch):
    AiGeneration.objects.bulk_create([AiGeneration(user=admin, organization=org) for _ in range(DAILY_LIMIT)])
    r = client(admin).post("/api/ai/generate", {"prompt": "x"}, format="multipart", **h(org))
    assert r.status_code == 429 and r.data["remaining"] == 0


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_reserved_slot_refunded_on_bad_input(admin, org):
    """A request that reserves a slot but then fails validation must not burn the cap."""
    r = client(admin).post("/api/ai/generate", {}, format="multipart", **h(org))
    assert r.status_code == 400
    assert AiGeneration.objects.filter(user=admin, organization=org).count() == 0


@override_settings(ANTHROPIC_API_KEY="test-key")
def test_slot_refunded_on_model_error(admin, org, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("provider down")
    monkeypatch.setattr(generator, "_call_model", boom)
    api = client(admin)
    api.raise_request_exception = False   # capture the 500 response instead of re-raising
    r = api.post("/api/ai/generate", {"prompt": "x"}, format="multipart", **h(org))
    assert r.status_code >= 500
    assert AiGeneration.objects.filter(user=admin, organization=org).count() == 0
