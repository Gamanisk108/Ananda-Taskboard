"""Store-readiness / PWA-integrity regression tests (protocol added 2026-06-10).

Guards the class of silent breakage found in the 2026-06-10 review: the PWA
manifest referenced icon files that never existed (the SPA fallback served
HTML for them, so nothing 404'd and nobody noticed). These assertions make
the build fail loudly instead:
  - every icon the manifest references actually exists in frontend/dist,
  - the favicon/apple-touch links in index.html resolve,
  - /privacy and /terms are served (store-listing URLs),
  - the in-app account-deletion endpoint exists.
"""

import json
import re
from pathlib import Path

import pytest

DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"


def test_manifest_icons_exist():
    manifest_path = DIST / "manifest.webmanifest"
    assert manifest_path.exists(), "manifest.webmanifest missing from dist"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    icons = manifest.get("icons", [])
    assert icons, "manifest declares no icons"
    for icon in icons:
        f = DIST / icon["src"].lstrip("/")
        assert f.exists(), f"manifest icon {icon['src']} does not exist in dist"
        # PNG magic bytes — guard against the SPA fallback's HTML being saved.
        assert f.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n", f"{icon['src']} is not a real PNG"


def test_index_html_icon_links_resolve():
    html = (DIST / "index.html").read_text(encoding="utf-8")
    for href in re.findall(r'<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]+href="([^"]+)"', html):
        f = DIST / href.lstrip("/")
        assert f.exists(), f"index.html links {href}, which does not exist in dist"


@pytest.mark.django_db
def test_legal_pages_are_served(client):
    for path in ("/privacy", "/terms"):
        res = client.get(path)
        # SPA fallback serves the app shell; the route renders client-side.
        assert res.status_code == 200, f"{path} did not return 200"


def test_account_deletion_endpoint_exists():
    from django.urls import resolve

    match = resolve("/api/me/delete")
    assert match.view_name == "me-delete"
