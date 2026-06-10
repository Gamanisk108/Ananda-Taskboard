"""Authenticated self-service password change (distinct from the email reset)."""
import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email="u@x.com", name="Uma", password="old-strong-123")


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def test_change_password_success(user):
    c = _auth(user)
    r = c.post("/api/auth/password/change",
               {"current_password": "old-strong-123", "new_password": "new-strong-456"}, format="json")
    assert r.status_code == 200
    user.refresh_from_db()
    assert user.check_password("new-strong-456")


def test_wrong_current_rejected(user):
    c = _auth(user)
    r = c.post("/api/auth/password/change",
               {"current_password": "WRONG", "new_password": "new-strong-456"}, format="json")
    assert r.status_code == 400
    user.refresh_from_db()
    assert user.check_password("old-strong-123")  # unchanged


def test_weak_new_password_rejected(user):
    c = _auth(user)
    r = c.post("/api/auth/password/change",
               {"current_password": "old-strong-123", "new_password": "123"}, format="json")
    assert r.status_code == 400


def test_requires_auth():
    r = APIClient().post("/api/auth/password/change",
                         {"current_password": "x", "new_password": "y"}, format="json")
    assert r.status_code in (401, 403)
