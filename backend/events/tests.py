from unittest import mock

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from events import emit
from events.models import Webhook


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def test_matches_all_when_blank(db):
    h = Webhook.objects.create(url="https://x/y", events="")
    assert h.matches("task.created") is True


def test_matches_specific_event(db):
    h = Webhook.objects.create(url="https://x/y", events="task.approved")
    assert h.matches("task.approved") is True
    assert h.matches("task.created") is False


def test_inactive_never_matches(db):
    h = Webhook.objects.create(url="https://x/y", events="", active=False)
    assert h.matches("task.created") is False


def test_emit_posts_to_matching_webhook(db):
    Webhook.objects.create(url="https://hooks.example/abc", events="task.created")
    with mock.patch("urllib.request.urlopen") as urlopen:
        emit.emit(emit.TASK_CREATED, {"task": 1})
        assert urlopen.called
        req = urlopen.call_args[0][0]
        assert req.full_url == "https://hooks.example/abc"


def test_emit_skips_non_matching(db):
    Webhook.objects.create(url="https://hooks.example/abc", events="task.approved")
    with mock.patch("urllib.request.urlopen") as urlopen:
        emit.emit(emit.TASK_CREATED, {"task": 1})
        assert not urlopen.called


def test_emit_never_raises_on_webhook_error(db):
    Webhook.objects.create(url="https://hooks.example/abc", events="")
    with mock.patch("urllib.request.urlopen", side_effect=Exception("boom")):
        emit.emit(emit.TASK_CREATED, {"task": 1})  # must not raise


def test_admin_can_crud_webhooks(admin):
    api = login(admin)
    r = api.post("/api/webhooks", {"url": "https://hooks.zapier.com/x", "events": ""}, format="json")
    assert r.status_code == 201
    wid = r.data["id"]
    assert api.get("/api/webhooks").status_code == 200
    assert api.delete(f"/api/webhooks/{wid}").status_code == 204


def test_member_cannot_manage_webhooks(member):
    assert login(member).get("/api/webhooks").status_code == 403
