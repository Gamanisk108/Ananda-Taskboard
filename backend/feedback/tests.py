"""Help Us flows: report-a-problem + suggest-a-feature records, the mono ref,
the screenshot cap, and the 90-day screenshot purge."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from feedback.models import FeatureSuggestion, ProblemReport, purge_old_screenshots


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def member(db):
    org = Organization.objects.create(name="Ananda LA", is_active=True)
    user = User.objects.create_user(email="m@x.com", name="Lila", password="pw-strong-123")
    Membership.objects.create(user=user, organization=org, role="member")
    return user


def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    assert res.status_code == 200, f"Login failed: {res.status_code} {res.data}"
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")


def test_report_creates_record_with_mono_ref(api, member):
    auth(api, member)
    res = api.post("/api/feedback/report", {
        "message": "The weekly view loses my scroll position.",
        "where": "calendar", "severity": "slows",
        "tech": {"ua": "test", "page": "/?view=weekly"},
    }, format="json")
    assert res.status_code == 201
    report = ProblemReport.objects.get()
    assert res.data["ref"] == report.ref and report.ref.startswith("TB-") and len(report.ref) >= 7
    assert report.severity == "slows" and report.tech["page"] == "/?view=weekly"


def test_report_requires_message_and_valid_fields(api, member):
    auth(api, member)
    assert api.post("/api/feedback/report", {"message": "  "}, format="json").status_code == 400
    assert api.post("/api/feedback/report", {"message": "x", "severity": "huge"}, format="json").status_code == 400
    assert api.post("/api/feedback/report",
                    {"message": "x", "screenshot": "not-a-data-url"}, format="json").status_code == 400


def test_screenshot_size_cap(api, member):
    auth(api, member)
    big = "data:image/jpeg;base64," + "A" * 1_500_000
    assert api.post("/api/feedback/report", {"message": "x", "screenshot": big}, format="json").status_code == 400
    ok = "data:image/jpeg;base64," + "A" * 1000
    assert api.post("/api/feedback/report", {"message": "x", "screenshot": ok}, format="json").status_code == 201


def test_suggest_creates_record(api, member):
    auth(api, member)
    res = api.post("/api/feedback/suggest", {
        "idea": "Board swimlanes by assignee", "detail": "Like Trello.",
        "area": "board", "notify_when_shipped": True,
    }, format="json")
    assert res.status_code == 201
    s = FeatureSuggestion.objects.get()
    assert s.idea.startswith("Board swimlanes") and s.notify_when_shipped


def test_suggest_requires_idea(api, member):
    auth(api, member)
    assert api.post("/api/feedback/suggest", {"idea": ""}, format="json").status_code == 400


def test_feedback_requires_auth(api, db):
    assert api.post("/api/feedback/report", {"message": "x"}, format="json").status_code == 401
    assert api.post("/api/feedback/suggest", {"idea": "x"}, format="json").status_code == 401


def test_purge_blanks_only_old_screenshots(api, member):
    auth(api, member)
    shot = "data:image/jpeg;base64,AAAA"
    api.post("/api/feedback/report", {"message": "old", "screenshot": shot}, format="json")
    api.post("/api/feedback/report", {"message": "new", "screenshot": shot}, format="json")
    old = ProblemReport.objects.get(message="old")
    ProblemReport.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=91))
    assert purge_old_screenshots() == 1
    old.refresh_from_db()
    new = ProblemReport.objects.get(message="new")
    assert old.screenshot == "" and old.message == "old"  # text kept, image gone
    assert new.screenshot == shot
