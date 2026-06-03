import pytest
from rest_framework.test import APIClient

from accounts.models import User
from projects.models import Project, SubProject
from tasks.models import Comment, Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


@pytest.fixture
def task(db):
    sp = SubProject.objects.create(project=Project.objects.create(name="P"), name="SP")
    return Task.objects.create(subproject=sp, title="T")


def test_comment_stores_mentions(admin, task):
    from permissions.models import AccessGrant
    bob = User.objects.create_user(email="b@example.com", name="Bob", password="pw-strong-123")
    AccessGrant.objects.create(user=bob, subproject=task.subproject, level="viewer")  # can see the task
    res = login(admin).post(
        f"/api/tasks/{task.id}/comments",
        {"text": "hey @Bob look", "mentions": [bob.id]},
        format="json",
    )
    assert res.status_code == 201
    comment = Comment.objects.get(id=res.data["id"])
    assert list(comment.mentions.values_list("id", flat=True)) == [bob.id]


def test_mention_without_task_access_is_dropped(admin, task):
    # A user with no visibility to the task must not be mentioned/notified.
    stranger = User.objects.create_user(email="s@example.com", name="Stranger", password="pw-strong-123")
    res = login(admin).post(
        f"/api/tasks/{task.id}/comments",
        {"text": "@Stranger", "mentions": [stranger.id]},
        format="json",
    )
    assert res.status_code == 201
    assert Comment.objects.get(id=res.data["id"]).mentions.count() == 0


def test_comment_without_mentions_ok(admin, task):
    res = login(admin).post(f"/api/tasks/{task.id}/comments", {"text": "plain"}, format="json")
    assert res.status_code == 201
    assert Comment.objects.get(id=res.data["id"]).mentions.count() == 0


def _comment(api, task, text="orig"):
    return api.post(f"/api/tasks/{task.id}/comments", {"text": text}, format="json").data["id"]


def test_author_can_edit_then_delete(admin, task):
    api = login(admin)
    cid = _comment(api, task)
    r = api.patch(f"/api/comments/{cid}", {"text": "edited"}, format="json")
    assert r.status_code == 200 and r.data["text"] == "edited"
    assert api.delete(f"/api/comments/{cid}").status_code == 204


def test_non_author_member_cannot_edit(admin, task):
    from permissions.models import AccessGrant
    mem = User.objects.create_user(email="m@example.com", name="M", password="pw-strong-123")
    AccessGrant.objects.create(user=mem, subproject=task.subproject, level="member")
    cid = _comment(login(admin), task)  # authored by admin
    r = login(mem).patch(f"/api/comments/{cid}", {"text": "x"}, format="json")
    assert r.status_code == 403


def test_admin_can_delete_others_comment(admin, task):
    from permissions.models import AccessGrant
    mem = User.objects.create_user(email="m2@example.com", name="M2", password="pw-strong-123")
    AccessGrant.objects.create(user=mem, subproject=task.subproject, level="member")
    cid = _comment(login(mem), task)  # authored by member
    assert login(admin).delete(f"/api/comments/{cid}").status_code == 204
