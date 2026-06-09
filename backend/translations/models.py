"""Community Translations (the "Help Us" flagship, design D37/D38).

Members suggest clearer wording per UI string; the platform owner approves a
winner that goes live at runtime with no redeploy. Suggestions and overrides are
platform-global (NOT per-org — v1 scope per the design handoff): a better Spanish
wording helps every org at once.

The string catalog itself lives in the frontend (frontend/src/locales/en.json is
the source of truth for *what can be translated*); the backend stores only keys.
Resolution order in the app: live override → bundled catalog → English.
"""

from django.conf import settings
from django.db import models


def normalize_text(text: str) -> str:
    """Grouping form of a suggestion/source string: trim + collapse internal
    whitespace + drop a trailing ellipsis. NEVER casefolds — casing is meaningful
    in several locales. Used to group poll variants and to fuzzy-merge
    near-identical English sources; raw text is always what gets stored/shown."""
    out = " ".join(text.split())
    for suffix in ("…", "..."):
        if out.endswith(suffix):
            out = out[: -len(suffix)].rstrip()
    return out


class TranslationSuggestion(models.Model):
    """One member's current proposed wording for one string in one locale.
    Unique per (key, locale, user): re-saving UPDATES the row — a saved row stays
    editable forever (an explicit design requirement, D37)."""

    key = models.CharField(max_length=200, db_index=True)
    locale = models.CharField(max_length=10, db_index=True)
    text = models.TextField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="translation_suggestions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]
        constraints = [
            models.UniqueConstraint(
                fields=["key", "locale", "user"], name="one_suggestion_per_key_locale_user"
            ),
        ]

    def __str__(self):
        return f"{self.locale}:{self.key} by {self.user} → {self.text[:40]!r}"


class TranslationOverride(models.Model):
    """The approved live wording for one string in one locale (at most one).
    Served to every client at runtime; deleting it falls back to the bundled
    catalog. Approval is superuser-only (the platform owner curates)."""

    key = models.CharField(max_length=200, db_index=True)
    locale = models.CharField(max_length=10, db_index=True)
    text = models.TextField()
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="translation_approvals"
    )
    approved_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["locale", "key"]
        constraints = [
            models.UniqueConstraint(fields=["key", "locale"], name="one_override_per_key_locale"),
        ]

    def __str__(self):
        return f"{self.locale}:{self.key} → {self.text[:40]!r}"
