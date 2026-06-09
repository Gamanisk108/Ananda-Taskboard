"""Community Translations: member suggestions, the live-override boot map, and
the superadmin review/approve loop (design D37/D38)."""

import pytest
from rest_framework.test import APIClient

from accounts.models import Membership, Organization, User
from translations.models import TranslationOverride, TranslationSuggestion, normalize_text


@pytest.fixture
def api():
    return APIClient()


def auth(api, user):
    res = api.post("/api/auth/login", {"email": user.email, "password": "pw-strong-123"}, format="json")
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")


@pytest.fixture
def world(db):
    org = Organization.objects.create(name="Ananda LA", is_active=True)
    m1 = User.objects.create_user(email="m1@x.com", name="Lila", password="pw-strong-123")
    m2 = User.objects.create_user(email="m2@x.com", name="Gita", password="pw-strong-123")
    Membership.objects.create(user=m1, organization=org, role="member")
    Membership.objects.create(user=m2, organization=org, role="member")
    su = User.objects.create_superuser(email="root@x.com", name="Root", password="pw-strong-123")
    return {"org": org, "m1": m1, "m2": m2, "su": su}


# --- normalization -----------------------------------------------------------

def test_normalize_collapses_whitespace_and_trailing_ellipsis():
    assert normalize_text("  Add   link…  ") == "Add link"
    assert normalize_text("Add link...") == "Add link"
    # casing is preserved — never casefold (locale-meaningful)
    assert normalize_text("Marcar como Hecho") == "Marcar como Hecho"


# --- member suggestions ------------------------------------------------------

def test_member_can_save_and_resave_a_suggestion(api, world):
    auth(api, world["m1"])
    res = api.put("/api/translations/mine",
                  {"locale": "es", "entries": [{"key": "task.markDone", "text": "Marcar como hecho"}]},
                  format="json")
    assert res.status_code == 200 and res.data["saved"] == 1
    # re-save updates the same row (a saved row stays editable — D37), no duplicate
    api.put("/api/translations/mine",
            {"locale": "es", "entries": [{"key": "task.markDone", "text": "Marcar como completado"}]},
            format="json")
    rows = TranslationSuggestion.objects.filter(user=world["m1"], locale="es", key="task.markDone")
    assert rows.count() == 1 and rows.first().text == "Marcar como completado"
    mine = api.get("/api/translations/mine?locale=es")
    assert [r["text"] for r in mine.data] == ["Marcar como completado"]


def test_batch_save_covers_fuzzy_merged_keys(api, world):
    auth(api, world["m1"])
    res = api.put("/api/translations/mine",
                  {"locale": "es", "entries": [
                      {"key": "task.addLink", "text": "Añadir enlace"},
                      {"key": "modals.addLink", "text": "Añadir enlace"},
                  ]}, format="json")
    assert res.status_code == 200 and res.data["saved"] == 2
    assert TranslationSuggestion.objects.filter(user=world["m1"], locale="es").count() == 2


def test_suggestion_validation(api, world):
    auth(api, world["m1"])
    put = lambda body: api.put("/api/translations/mine", body, format="json")  # noqa: E731
    assert put({"locale": "en", "entries": [{"key": "a.b", "text": "x"}]}).status_code == 400  # en is source
    assert put({"locale": "xx", "entries": [{"key": "a.b", "text": "x"}]}).status_code == 400
    assert put({"locale": "es", "entries": [{"key": "bad key!", "text": "x"}]}).status_code == 400
    assert put({"locale": "es", "entries": [{"key": "a.b", "text": "  "}]}).status_code == 400
    assert put({"locale": "es", "entries": [{"key": "a.b", "text": "x" * 601}]}).status_code == 400
    assert put({"locale": "es", "entries": []}).status_code == 400


def test_suggestions_require_auth(api, db):
    assert api.get("/api/translations/mine?locale=es").status_code == 401


# --- review (superadmin poll) ------------------------------------------------

def test_review_groups_variants_and_counts_distinct_submitters(api, world):
    auth(api, world["m1"])
    api.put("/api/translations/mine",
            {"locale": "es", "entries": [{"key": "task.markDone", "text": "Marcar como hecho"}]},
            format="json")
    auth(api, world["m2"])
    # same wording but with stray whitespace → groups with m1's variant
    api.put("/api/translations/mine",
            {"locale": "es", "entries": [{"key": "task.markDone", "text": " Marcar  como hecho "},
                                          {"key": "list.clear", "text": "Borrar filtros"}]},
            format="json")
    auth(api, world["su"])
    res = api.get("/api/translations/review?locale=es")
    assert res.status_code == 200
    polls = {p["key"]: p for p in res.data}
    done = polls["task.markDone"]
    assert done["total"] == 2 and len(done["variants"]) == 1
    assert done["variants"][0]["count"] == 2
    assert set(done["variants"][0]["users"]) == {"Lila", "Gita"}
    assert polls["list.clear"]["total"] == 1
    # most-discussed key sorts first
    assert res.data[0]["key"] == "task.markDone"


def test_review_is_superuser_only(api, world):
    auth(api, world["m1"])
    assert api.get("/api/translations/review?locale=es").status_code == 403


# --- approve / clear override ------------------------------------------------

def test_approve_sets_live_override_served_to_members(api, world):
    auth(api, world["su"])
    res = api.post("/api/translations/approve",
                   {"locale": "es", "key": "task.markDone", "text": "Marcar como hecho"}, format="json")
    assert res.status_code == 200
    # any member's boot fetch now carries it
    auth(api, world["m1"])
    res = api.get("/api/translations/overrides?locale=es")
    assert res.data == {"task.markDone": "Marcar como hecho"}
    # review still responds (no suggestions yet → empty poll list)
    auth(api, world["su"])
    res = api.get("/api/translations/review?locale=es")
    assert res.status_code == 200 and res.data == []


def test_reapprove_replaces_not_duplicates(api, world):
    auth(api, world["su"])
    api.post("/api/translations/approve", {"locale": "es", "key": "k.a", "text": "uno"}, format="json")
    api.post("/api/translations/approve", {"locale": "es", "key": "k.a", "text": "dos"}, format="json")
    rows = TranslationOverride.objects.filter(locale="es", key="k.a")
    assert rows.count() == 1 and rows.first().text == "dos"


def test_clear_override_falls_back(api, world):
    auth(api, world["su"])
    api.post("/api/translations/approve", {"locale": "es", "key": "k.a", "text": "uno"}, format="json")
    res = api.delete("/api/translations/override", {"locale": "es", "key": "k.a"}, format="json")
    assert res.status_code == 204
    assert not TranslationOverride.objects.filter(locale="es", key="k.a").exists()


def test_approve_is_superuser_only(api, world):
    auth(api, world["m1"])
    assert api.post("/api/translations/approve",
                    {"locale": "es", "key": "k.a", "text": "x"}, format="json").status_code == 403
    assert api.delete("/api/translations/override",
                      {"locale": "es", "key": "k.a"}, format="json").status_code == 403
