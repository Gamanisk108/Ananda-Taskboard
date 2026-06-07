import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Status, Task, complete_status_keys


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_default_statuses_seeded(db):
    assert set(Status.objects.values_list("key", flat=True)) >= {"todo", "in_progress", "delayed", "done"}
    assert complete_status_keys() == ["done"]


def test_anyone_reads_statuses(member):
    res = login(member).get("/api/statuses")
    assert res.status_code == 200 and len(res.data) >= 4


def test_admin_adds_status_with_slug(admin):
    res = login(admin).post("/api/statuses", {"label": "In Review", "color": "#123456"}, format="json")
    assert res.status_code == 201
    assert res.data["key"] == "in-review"


def test_member_cannot_edit_statuses(member):
    res = login(member).post("/api/statuses", {"label": "X"}, format="json")
    assert res.status_code == 403


def test_status_change_accepts_custom_status(admin, sp):
    Status.objects.create(key="in-review", label="In Review", order=5)
    t = Task.objects.create(subproject=sp, title="T")
    res = login(admin).post(f"/api/tasks/{t.id}/status", {"status": "in-review"}, format="json")
    assert res.status_code == 200
    t.refresh_from_db()
    assert t.status == "in-review"


def test_status_change_rejects_unknown(admin, sp):
    t = Task.objects.create(subproject=sp, title="T")
    res = login(admin).post(f"/api/tasks/{t.id}/status", {"status": "nope"}, format="json")
    assert res.status_code == 400


def test_member_can_move_own_task(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=sp, title="T")
    t.assignees.add(member)
    res = login(member).post(f"/api/tasks/{t.id}/status", {"status": "in_progress"}, format="json")
    assert res.status_code == 200


def test_monitor_field_roundtrips(admin, sp):
    api = login(admin)
    res = api.post("/api/tasks", {"subproject": sp.id, "title": "Watched", "monitor": True}, format="json")
    assert res.status_code == 201 and res.data["monitor"] is True


def test_create_honors_initial_status(sp, db):
    # DN9: a valid status chosen at creation is applied (status is read-only on update).
    from tasks.serializers import TaskSerializer
    s = TaskSerializer(data={"subproject": sp.id, "title": "T", "status": "in_progress"})
    assert s.is_valid(), s.errors
    task = s.save()
    assert task.status == "in_progress"


def test_create_ignores_invalid_status(sp, db):
    from tasks.serializers import TaskSerializer
    s = TaskSerializer(data={"subproject": sp.id, "title": "T2", "status": "bogus-key"})
    assert s.is_valid(), s.errors
    task = s.save()
    assert task.status != "bogus-key"
