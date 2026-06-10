"""Community Translations API.

- /translations/mine       member: read + batch-upsert their own suggestions;
                           DELETE retracts their own suggestion(s)
- /translations/overrides  any authenticated client: the live overrides (boot fetch)
- /translations/review     superuser: poll data (variants grouped + counted)
- /translations/approve    superuser: set the live wording for a key+locale
- /translations/override   superuser: DELETE clears an override (fall back to bundled)
- /translations/suggestion superuser: DELETE dismisses a suggested variant from the poll
"""

import re

from django.db import transaction
from rest_framework import status as http
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import SUPPORTED_LANGUAGES
from permissions.drf import IsSuperUser

from .models import TranslationOverride, TranslationSuggestion, normalize_text

# English is the read-only source language, never a target (D37).
TARGET_LOCALES = [code for code in SUPPORTED_LANGUAGES if code != "en"]

KEY_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,200}$")
MAX_TEXT = 600          # longest bundled string is well under this
MAX_BATCH = 50          # fuzzy-merge fan-out stays small (a handful of variants)


def _bad(msg):
    return Response({"detail": msg}, status=http.HTTP_400_BAD_REQUEST)


def _locale_or_none(value):
    return value if value in TARGET_LOCALES else None


class MySuggestionsView(APIView):
    """The signed-in member's own suggestions for one locale."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        locale = _locale_or_none(request.query_params.get("locale", ""))
        if not locale:
            return _bad("Unknown or missing locale.")
        rows = TranslationSuggestion.objects.filter(user=request.user, locale=locale)
        return Response([{"key": s.key, "text": s.text, "updated_at": s.updated_at} for s in rows])

    def put(self, request):
        """Batch upsert: {locale, entries: [{key, text}, …]}. A batch because a
        fuzzy-merged row saves one wording across several near-identical keys."""
        locale = _locale_or_none(request.data.get("locale", ""))
        if not locale:
            return _bad("Unknown or missing locale.")
        entries = request.data.get("entries")
        if not isinstance(entries, list) or not entries:
            return _bad("entries must be a non-empty list.")
        if len(entries) > MAX_BATCH:
            return _bad(f"At most {MAX_BATCH} entries per save.")
        cleaned = []
        for e in entries:
            key = e.get("key") if isinstance(e, dict) else None
            text = e.get("text") if isinstance(e, dict) else None
            if not key or not KEY_RE.match(key):
                return _bad("Invalid key.")
            if not isinstance(text, str) or not text.strip():
                return _bad("Suggestion text is required.")
            if len(text) > MAX_TEXT:
                return _bad(f"Suggestions are limited to {MAX_TEXT} characters.")
            cleaned.append((key, text.strip()))
        # One transaction: a fuzzy-merged row's fan-out saves all-or-nothing.
        with transaction.atomic():
            for key, text in cleaned:
                TranslationSuggestion.objects.update_or_create(
                    key=key, locale=locale, user=request.user, defaults={"text": text}
                )
        return Response({"saved": len(cleaned)})

    def delete(self, request):
        """Retract the caller's own suggestion(s): {locale, keys: [...]}. A batch
        for the same reason as PUT — a fuzzy-merged row fans out over keys."""
        locale = _locale_or_none(request.data.get("locale", ""))
        if not locale:
            return _bad("Unknown or missing locale.")
        keys = request.data.get("keys")
        if not isinstance(keys, list) or not keys or len(keys) > MAX_BATCH:
            return _bad(f"keys must be a non-empty list of at most {MAX_BATCH}.")
        if not all(isinstance(k, str) and KEY_RE.match(k) for k in keys):
            return _bad("Invalid key.")
        deleted, _ = TranslationSuggestion.objects.filter(
            user=request.user, locale=locale, key__in=keys
        ).delete()
        return Response({"deleted": deleted})


class OverridesView(APIView):
    """The live override map for one locale — fetched at app boot and merged over
    the bundled catalog (resolution: override → bundled → English)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        locale = _locale_or_none(request.query_params.get("locale", ""))
        if not locale:
            return _bad("Unknown or missing locale.")
        rows = TranslationOverride.objects.filter(locale=locale)
        return Response({o.key: o.text for o in rows})


class ReviewView(APIView):
    """Poll data for the superadmin review tool (design D38): per key, the
    distinct suggested variants (grouped by normalized text), each with its
    submitter count + names, plus the currently-live override if any."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        locale = _locale_or_none(request.query_params.get("locale", ""))
        if not locale:
            return _bad("Unknown or missing locale.")
        live = {o.key: o.text for o in TranslationOverride.objects.filter(locale=locale)}
        polls = {}  # key → {norm → {"text", "users": [names]}}
        rows = (
            TranslationSuggestion.objects.filter(locale=locale)
            .select_related("user")
            .order_by("-updated_at")
        )
        for s in rows:
            variants = polls.setdefault(s.key, {})
            norm = normalize_text(s.text)
            v = variants.setdefault(norm, {"text": s.text, "users": []})
            v["users"].append(s.user.name or s.user.email)
        out = []
        for key, variants in polls.items():
            vs = [
                {"text": v["text"], "count": len(v["users"]), "users": v["users"]}
                for v in variants.values()
            ]
            vs.sort(key=lambda v: -v["count"])
            out.append({
                "key": key,
                "live": live.get(key),
                "total": sum(v["count"] for v in vs),
                "variants": vs,
            })
        out.sort(key=lambda p: -p["total"])
        return Response(out)


class ApproveView(APIView):
    """Make a wording live for everyone in a locale — instantly, no redeploy."""

    permission_classes = [IsSuperUser]

    def post(self, request):
        locale = _locale_or_none(request.data.get("locale", ""))
        key = request.data.get("key", "")
        text = request.data.get("text", "")
        if not locale:
            return _bad("Unknown or missing locale.")
        if not key or not KEY_RE.match(key):
            return _bad("Invalid key.")
        if not isinstance(text, str) or not text.strip():
            return _bad("Override text is required.")
        if len(text) > MAX_TEXT:
            return _bad(f"Overrides are limited to {MAX_TEXT} characters.")
        TranslationOverride.objects.update_or_create(
            key=key, locale=locale, defaults={"text": text.strip(), "approved_by": request.user}
        )
        return Response({"ok": True})


class OverrideView(APIView):
    """DELETE clears an override → the app falls back to the bundled wording."""

    permission_classes = [IsSuperUser]

    def delete(self, request):
        locale = _locale_or_none(request.data.get("locale", ""))
        key = request.data.get("key", "")
        if not locale or not key:
            return _bad("locale and key are required.")
        TranslationOverride.objects.filter(locale=locale, key=key).delete()
        return Response(status=http.HTTP_204_NO_CONTENT)


class SuggestionDismissView(APIView):
    """Moderation: DELETE removes a suggested variant from the poll —
    {locale, key, text} deletes every suggestion whose normalized text matches.
    Without this, a junk/abusive suggestion would sit in the poll forever (the
    only other 'remedy' was approving different wording)."""

    permission_classes = [IsSuperUser]

    def delete(self, request):
        locale = _locale_or_none(request.data.get("locale", ""))
        key = request.data.get("key", "")
        text = request.data.get("text", "")
        if not locale or not key or not KEY_RE.match(key):
            return _bad("locale and key are required.")
        if not isinstance(text, str) or not text.strip():
            return _bad("text identifies the variant to dismiss.")
        norm = normalize_text(text)
        ids = [
            s.id
            for s in TranslationSuggestion.objects.filter(locale=locale, key=key)
            if normalize_text(s.text) == norm
        ]
        deleted, _ = TranslationSuggestion.objects.filter(id__in=ids).delete()
        return Response({"deleted": deleted})
