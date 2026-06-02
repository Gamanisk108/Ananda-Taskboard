import csv
import io

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from exporting.export import sanitize_csv
from permissions.models import AccessGrant
from projects.models import Project, SubProject
from tasks.models import Task


@pytest.fixture
def admin(db):
    return User.objects.create_superuser(email="a@example.com", name="Ada", password="pw-strong-123")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@example.com", name="Mara", password="pw-strong-123")


@pytest.fixture
def sp(db):
    return SubProject.objects.create(project=Project.objects.create(name="Karuna"), name="Marketing")


def login(user):
    api = APIClient()
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    return api


def read_csv(resp):
    return list(csv.reader(io.StringIO(resp.content.decode("utf-8"))))


# --- sanitization (unit) ----------------------------------------------------

@pytest.mark.parametrize("dangerous", ["=1+1", "+x", "-x", "@x", "\tx"])
def test_sanitize_prefixes_dangerous(dangerous):
    assert sanitize_csv(dangerous).startswith("'")


def test_sanitize_leaves_safe_values():
    assert sanitize_csv("Design flyer") == "Design flyer"
    assert sanitize_csv("") == ""


# --- CSV export -------------------------------------------------------------

def test_csv_has_header_and_rows(admin, sp):
    Task.objects.create(subproject=sp, title="Flyer")
    rows = read_csv(login(admin).get("/api/export?fmt=csv"))
    assert rows[0][0] == "Project"
    assert any("Flyer" in r for r in rows[1:])


def test_empty_export_still_valid(admin, db):
    rows = read_csv(login(admin).get("/api/export?fmt=csv"))
    assert rows == [[
        "Project", "Sub-project", "Title", "Status", "Approval", "Deadline",
        "Recurrence", "Assignees", "Details", "Requirements", "Links",
    ]]


def test_formula_injection_sanitized_in_output(admin, sp):
    Task.objects.create(subproject=sp, title="=cmd|'/c calc'!A1")
    rows = read_csv(login(admin).get("/api/export?fmt=csv"))
    title_cell = rows[1][2]
    assert title_cell.startswith("'=")  # neutralized


def test_commas_quotes_newlines_emoji_roundtrip(admin, sp):
    Task.objects.create(subproject=sp, title='A, "B"\nC 🎉')
    rows = read_csv(login(admin).get("/api/export?fmt=csv"))
    assert rows[1][2] == 'A, "B"\nC 🎉'  # csv quoting preserved it intact


def test_export_excludes_hidden_subprojects(member, sp):
    hidden = SubProject.objects.create(project=Project.objects.create(name="H"), name="Warehouse")
    AccessGrant.objects.create(user=member, subproject=sp, level="member")
    Task.objects.create(subproject=sp, title="Mine")
    Task.objects.create(subproject=hidden, title="NotMine")
    rows = read_csv(login(member).get("/api/export?fmt=csv"))
    flat = [c for r in rows for c in r]
    assert "Mine" in flat and "NotMine" not in flat


def test_export_excludes_pending(admin, sp):
    Task.objects.create(subproject=sp, title="Pending", approval_state="pending")
    rows = read_csv(login(admin).get("/api/export?fmt=csv"))
    flat = [c for r in rows for c in r]
    assert "Pending" not in flat


# --- XLSX export ------------------------------------------------------------

def test_xlsx_is_valid_workbook(admin, sp):
    from openpyxl import load_workbook

    Task.objects.create(subproject=sp, title="Flyer")
    resp = login(admin).get("/api/export?fmt=xlsx")
    assert resp["Content-Type"].startswith("application/vnd.openxmlformats")
    wb = load_workbook(io.BytesIO(resp.content))
    ws = wb.active
    assert ws["A1"].value == "Project"
    assert any(cell.value == "Flyer" for col in ws.iter_cols() for cell in col)
