import pytest
from rest_framework.test import APIClient

from accounts.models import User
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


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


def test_viewer_can_comment(viewer, sp):
    AccessGrant.objects.create(user=viewer, subproject=sp, level="viewer")
    t = Task.objects.create(subproject=sp, title="T")
    res = login(viewer).post(f"/api/tasks/{t.id}/comments", {"text": "Looks good"}, format="json")
    assert res.status_code == 201
    assert res.data["text"] == "Looks good"


def test_comments_listed_in_order(admin, sp):
    t = Task.objects.create(subproject=sp, title="T")
    api = login(admin)
    api.post(f"/api/tasks/{t.id}/comments", {"text": "first"}, format="json")
    api.post(f"/api/tasks/{t.id}/comments", {"text": "second"}, format="json")
    res = api.get(f"/api/tasks/{t.id}/comments")
    assert [c["text"] for c in res.data] == ["first", "second"]


def test_empty_comment_rejected(admin, sp):
    t = Task.objects.create(subproject=sp, title="T")
    res = login(admin).post(f"/api/tasks/{t.id}/comments", {"text": "   "}, format="json")
    assert res.status_code == 400


def test_outsider_cannot_comment_on_hidden_task(outsider, sp):
    t = Task.objects.create(subproject=sp, title="Secret")
    res = login(outsider).post(f"/api/tasks/{t.id}/comments", {"text": "hi"}, format="json")
    assert res.status_code == 404  # task not visible → IDOR-safe


def test_comment_count_reflected_on_task(admin, sp):
    t = Task.objects.create(subproject=sp, title="T")
    api = login(admin)
    api.post(f"/api/tasks/{t.id}/comments", {"text": "a"}, format="json")
    res = api.get(f"/api/tasks/{t.id}")
    assert res.data["comment_count"] == 1
