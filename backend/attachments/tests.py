"""Attachment endpoints with R2 mocked (no network)."""
import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from attachments import r2 as r2mod
from attachments.models import Attachment
from feedback.models import ProblemReport
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Subtask, Task


@pytest.fixture(autouse=True)
def _r2(settings, monkeypatch):
    settings.R2_ENDPOINT_URL = "https://acct.r2.cloudflarestorage.com"
    settings.R2_ACCESS_KEY_ID = "k"
    settings.R2_SECRET_ACCESS_KEY = "s"
    settings.R2_BUCKET = "taskboard-media"
    monkeypatch.setattr(r2mod, "presign_put", lambda key, ct, expires=300: f"https://put/{key}")
    monkeypatch.setattr(r2mod, "presign_get", lambda key, fn="", expires=300: f"https://get/{key}")
    monkeypatch.setattr(r2mod, "delete", lambda key: None)
    # Default: object exists, image, 50 KB.
    monkeypatch.setattr(r2mod, "head", lambda key: {"ContentType": "image/jpeg", "ContentLength": 50_000})


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Ananda", is_active=True)


def _u(org, email, role="member"):
    u = User.objects.create_user(email=email, password="pw-strong-123")
    Membership.objects.create(user=u, organization=org, role=role, is_active=True)
    return u


@pytest.fixture
def member(org):
    return _u(org, "m@x.com")


@pytest.fixture
def other(org):
    return _u(org, "o@x.com")


@pytest.fixture
def sp(db, org):
    return SubProject.objects.create(project=Project.objects.create(name="K", organization=org), name="Mktg")


@pytest.fixture
def task(sp, member):
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    return Task.objects.create(subproject=sp, title="T")


def _auth(user, org):
    c = APIClient(); c.force_authenticate(user=user)
    return c, {"HTTP_X_ORG_ID": str(org.id)}


def test_presign_then_confirm_creates(task, member, org):
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "shot.jpg",
               "content_type": "image/jpeg", "size": 50_000}, format="json", **h)
    assert r.status_code == 200, r.content
    key = r.json()["key"]
    assert r.json()["put_url"]
    r2 = c.post("/api/attachments", {"task": task.id, "key": key, "filename": "shot.jpg"}, format="json", **h)
    assert r2.status_code == 201, r2.content
    assert "/file?t=" in r2.json()["url"]
    assert Attachment.objects.filter(task=task).count() == 1


def test_presign_rejects_bad_type(task, member, org):
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "x.exe",
               "content_type": "application/x-msdownload", "size": 1000}, format="json", **h)
    assert r.status_code == 400


def test_presign_rejects_too_large(task, member, org):
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "big.jpg",
               "content_type": "image/jpeg", "size": 9_000_000}, format="json", **h)
    assert r.status_code == 400


def test_presign_over_cap(task, member, org):
    for i in range(5):
        Attachment.objects.create(task=task, key=f"task/{task.id}/{i}", filename=f"{i}.jpg", kind="image", size=10)
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "x.jpg",
               "content_type": "image/jpeg", "size": 1000}, format="json", **h)
    assert r.status_code == 400


def test_presign_no_access_forbidden(task, other, org):
    c, h = _auth(other, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "x.jpg",
               "content_type": "image/jpeg", "size": 1000}, format="json", **h)
    assert r.status_code in (403, 404)


def test_list_and_file_and_delete(task, member, org):
    att = Attachment.objects.create(task=task, key=f"task/{task.id}/a", filename="a.jpg", kind="image", size=10, uploaded_by=member)
    c, h = _auth(member, org)
    lst = c.get(f"/api/attachments?task={task.id}", **h)
    assert lst.status_code == 200 and len(lst.json()) == 1
    file_url = lst.json()[0]["url"]  # signed capability link
    fr = c.get(file_url)  # no auth header needed — token is the grant
    assert fr.status_code == 302 and "https://get/" in fr["Location"]
    assert c.get(f"/api/attachments/{att.id}/file?t=bad").status_code == 403
    dr = c.delete(f"/api/attachments/{att.id}", **h)
    assert dr.status_code == 204
    assert Attachment.objects.count() == 0


def test_doc_and_video_allowed(task, member, org, monkeypatch):
    monkeypatch.setattr(r2mod, "head", lambda key: {"ContentType": "application/pdf", "ContentLength": 100_000})
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "d.pdf",
               "content_type": "application/pdf", "size": 100_000}, format="json", **h)
    assert r.status_code == 200, r.content


def test_report_attachment_owner_only(org, member, other):
    rep = ProblemReport.objects.create(user=member, organization=org, message="bug")
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"report": rep.id, "filename": "s.jpg",
               "content_type": "image/jpeg", "size": 5000}, format="json", **h)
    assert r.status_code == 200, r.content
    c2, h2 = _auth(other, org)
    r2 = c2.post("/api/attachments/presign", {"report": rep.id, "filename": "s.jpg",
                 "content_type": "image/jpeg", "size": 5000}, format="json", **h2)
    assert r2.status_code in (403, 404)


def test_not_configured_503(task, member, org, settings):
    settings.R2_ENDPOINT_URL = ""
    c, h = _auth(member, org)
    r = c.post("/api/attachments/presign", {"task": task.id, "filename": "x.jpg",
               "content_type": "image/jpeg", "size": 1000}, format="json", **h)
    assert r.status_code == 503
