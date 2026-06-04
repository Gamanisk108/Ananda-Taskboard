"""Frontend i18n catalog integrity (checked from the backend test suite so it
runs in CI): every locale must have exactly the same keys as the English base —
no missing translations, no stray keys — and every backend SUPPORTED_LANGUAGE
must have a catalog file."""

import json
from pathlib import Path

import pytest

from accounts.models import SUPPORTED_LANGUAGES

LOCALES = Path(__file__).resolve().parent.parent / "frontend" / "src" / "locales"


def _flat_keys(d, prefix=""):
    keys = set()
    for k, v in d.items():
        full = f"{prefix}{k}"
        if isinstance(v, dict):
            keys |= _flat_keys(v, f"{full}.")
        else:
            keys.add(full)
    return keys


def _load(code):
    return json.loads((LOCALES / f"{code}.json").read_text(encoding="utf-8"))


def test_every_supported_language_has_a_catalog():
    for code in SUPPORTED_LANGUAGES:
        assert (LOCALES / f"{code}.json").exists(), f"missing catalog: {code}.json"


@pytest.mark.parametrize("code", [c for c in SUPPORTED_LANGUAGES if c != "en"])
def test_catalog_keys_match_english(code):
    en_keys = _flat_keys(_load("en"))
    keys = _flat_keys(_load(code))
    missing = en_keys - keys
    extra = keys - en_keys
    assert not missing, f"{code}.json is missing keys: {sorted(missing)}"
    assert not extra, f"{code}.json has unexpected keys: {sorted(extra)}"


@pytest.mark.parametrize("code", SUPPORTED_LANGUAGES)
def test_catalog_values_nonempty(code):
    for key in _flat_keys(_load(code)):
        # walk to the leaf value
        node = _load(code)
        for part in key.split("."):
            node = node[part]
        assert isinstance(node, str) and node.strip(), f"{code}.json: empty value for {key}"
