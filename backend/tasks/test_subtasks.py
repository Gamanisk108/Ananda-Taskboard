import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Subtask, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def viewer(db):
    return User.objects.create_user(email="v@example.com", name="Vee", password="pw-strong-123")


@pytest.fixture
def outsider(db):
    return User.objects.create_user(email="x@example.com", name="Ex", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_member_adds_and_lists_subtasks(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=sp, title="Parent")
    api = login(member)
    r = api.post(f"/api/tasks/{t.id}/subtasks", {"title": "Step 1"}, format="json")
    assert r.status_code == 201
    lst = api.get(f"/api/tasks/{t.id}/subtasks")
    assert [s["title"] for s in lst.data] == ["Step 1"]


def test_toggle_done(member, sp):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    t = Task.objects.create(subproject=sp, title="Parent")
    s = Subtask.objects.create(task=t, title="Step")
    api = login(member)
    r = api.patch(f"/api/subtasks/{s.id}", {"is_done": True}, format="json")
    assert r.status_code == 200
    s.refresh_from_db()
    assert s.is_done is True


def test_assignee_can_toggle_even_if_not_member(member, sp):
    # member-level not granted, but assigned → may manage checklist
    t = Task.objects.create(subproject=sp, title="Parent")
    t.assignees.add(member)
    AccessGrant.objects.create(user=member, subproject=sp, level="viewer")  # can see it
    s = Subtask.objects.create(task=t, title="Step")
    r = login(member).patch(f"/api/subtasks/{s.id}", {"is_done": True}, format="json")
    assert r.status_code == 200


def test_viewer_cannot_add_subtask(viewer, sp):
    AccessGrant.objects.create(user=viewer, subproject=sp, level="viewer")
    t = Task.objects.create(subproject=sp, title="Parent")
    r = login(viewer).post(f"/api/tasks/{t.id}/subtasks", {"title": "nope"}, format="json")
    assert r.status_code == 403


def test_outsider_cannot_see_subtasks(outsider, sp):
    t = Task.objects.create(subproject=sp, title="Secret")
    Subtask.objects.create(task=t, title="hidden")
    r = login(outsider).get(f"/api/tasks/{t.id}/subtasks")
    assert r.status_code == 404  # parent task not visible


def test_outsider_cannot_patch_subtask(outsider, sp):
    t = Task.objects.create(subproject=sp, title="Secret")
    s = Subtask.objects.create(task=t, title="hidden")
    r = login(outsider).patch(f"/api/subtasks/{s.id}", {"is_done": True}, format="json")
    assert r.status_code == 404


def test_delete_subtask(admin, sp):
    t = Task.objects.create(subproject=sp, title="Parent")
    s = Subtask.objects.create(task=t, title="Step")
    r = login(admin).delete(f"/api/subtasks/{s.id}")
    assert r.status_code == 204
    assert not Subtask.objects.filter(pk=s.id).exists()
