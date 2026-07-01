"""Public, UNAUTHENTICATED share routes (mounted at /s/, outside /api/).

  /s/<token>           -> a branded landing page whose <head> carries the Open
                          Graph + Twitter meta that Slack/WhatsApp/etc. unfurl,
                          plus an "Open in Taskboard" deep link into the SPA.
  /s/<token>/card.png  -> the 1200×630 preview image referenced by og:image.

Both expose ONLY card metadata. Revoked / missing / deleted -> 410 Gone.
"""

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseGone
from django.shortcuts import render

from . import card as cardmod
from . import describe as describe_mod
from .describe import describe, is_live
from .models import ShareLink

# Per-IP soft throttle on the unauthenticated routes (the card is re-rendered on
# a cache-miss, so an open loop shouldn't be free). Uses Django's cache framework
# — per-process with the default LocMemCache, automatically global if a shared
# cache (e.g. Redis) is configured later. Overridable in settings for tests.
_RL_WINDOW = 60  # seconds
_RL_DEFAULT_MAX = 240  # requests / window / IP (override via settings.SHARE_CARD_RATE_LIMIT)


def _client_ip(request) -> str:
    # Behind Render's proxy the real client is the first X-Forwarded-For hop;
    # REMOTE_ADDR alone would be the proxy (one bucket for everyone).
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def _rate_limited(request) -> bool:
    limit = getattr(settings, "SHARE_CARD_RATE_LIMIT", _RL_DEFAULT_MAX)
    key = f"sharecard:rl:{_client_ip(request)}"
    cache.get_or_set(key, 0, _RL_WINDOW)  # seed with the window TTL
    try:
        return cache.incr(key) > limit
    except ValueError:  # key expired between get_or_set and incr
        cache.set(key, 1, _RL_WINDOW)
        return False


def _too_many() -> HttpResponse:
    resp = HttpResponse("Too many requests.", status=429)
    resp["Retry-After"] = str(_RL_WINDOW)
    return resp


# Per-process memo of rendered PNGs keyed by ETag (token + updated_at + desc
# toggle). A repeat fetch of an unchanged card skips Pillow entirely; an edit
# changes the ETag and re-renders. Bounded so it can't grow without limit.
_CARD_CACHE: dict[str, bytes] = {}
_CARD_CACHE_MAX = 256


def _etag_for(token: str, spec) -> str:
    import hashlib

    payload = repr((cardmod.RENDER_VERSION, spec.kind, spec.title, spec.breadcrumb,
                    spec.description, spec.priority, spec.status, tuple(spec.assignees),
                    spec.accent))
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]
    return f'W/"{token}.{digest}"'


def _render_for_etag(etag: str, render_fn) -> bytes:
    png = _CARD_CACHE.get(etag)
    if png is None:
        png = render_fn()
        if len(_CARD_CACHE) >= _CARD_CACHE_MAX:
            _CARD_CACHE.clear()
        _CARD_CACHE[etag] = png
    return png


def _is_whatsapp(request) -> bool:
    # WhatsApp generates link previews client-side with a "WhatsApp/…" UA and
    # crops any og:image into a small SQUARE box — so we feed it a square variant.
    return "whatsapp" in request.META.get("HTTP_USER_AGENT", "").lower()


def _lookup(token: str):
    """Return (link, target) for a live share, or None if gone/revoked/deleted."""
    link = ShareLink.objects.filter(token=token).select_related("content_type").first()
    if link is None or link.is_revoked:
        return None
    target = link.target  # GenericForeignKey; None if the row was hard-deleted
    if target is None or not is_live(target):
        return None
    return link, target


def _spec_for(link, target):
    spec = describe(target)
    if not link.include_description:
        spec.description = ""
    return spec


def _excerpt(text: str, limit: int = 160) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _og_description(spec) -> str:
    """A compact one-liner for og:description (kind · breadcrumb · status ·
    priority · assignees — then the description excerpt if enabled)."""
    head = [spec.kind]
    if spec.breadcrumb:
        head.append(spec.breadcrumb)
    meta = []
    from . import brand

    if spec.status in brand.STATUS:
        meta.append(brand.STATUS[spec.status][0])
    if spec.priority in brand.PRIORITY:
        meta.append(f"{brand.PRIORITY[spec.priority][0]} priority")
    if spec.assignees:
        shown = ", ".join(spec.assignees[:3])
        extra = len(spec.assignees) - 3
        meta.append("Assigned to " + shown + (f" +{extra}" if extra > 0 else ""))
    line = " · ".join(head)
    if meta:
        line += " — " + " · ".join(meta)
    if spec.description:
        line += " — " + _excerpt(spec.description)
    return line


def share_landing(request, token):
    if _rate_limited(request):
        return _too_many()
    found = _lookup(token)
    if found is None:
        return render(request, "sharing/gone.html", status=410)
    link, target = found
    spec = _spec_for(link, target)
    detail = describe_mod.detail(target, include_description=link.include_description)
    # WhatsApp gets a SQUARE og:image (its preview box is square); everyone else
    # gets the wide summary_large_image card.
    wa = _is_whatsapp(request)
    img_path, img_wh = ("card-sq.png", 600) if wa else ("card.png", None)
    ctx = {
        "spec": spec,
        "d": detail,
        "title": spec.title,
        "description": _og_description(spec),
        "image_url": request.build_absolute_uri(f"/s/{token}/{img_path}"),
        "image_w": img_wh or 1200,
        "image_h": img_wh or 630,
        "twitter_card": "summary" if wa else "summary_large_image",
        "page_url": request.build_absolute_uri(f"/s/{token}"),
        "deep_link": request.build_absolute_uri(spec.deep_link),
    }
    return render(request, "sharing/unfurl.html", ctx)


def share_card(request, token):
    if _rate_limited(request):
        return _too_many()
    found = _lookup(token)
    if found is None:
        return HttpResponseGone("This share link is no longer available.")
    link, target = found
    # ETag is a hash of the FULL rendered spec (title, breadcrumb=parent names,
    # status, priority, assignee names, accent, description-after-toggle) so ANY
    # visible change — including a parent rename/recolor or an assignee rename —
    # busts the bot's cache, while an unchanged card stays cached.
    spec = _spec_for(link, target)
    etag = _etag_for(token, spec)
    if request.headers.get("If-None-Match") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        return resp
    png = _render_for_etag(etag, lambda: cardmod.render(spec))
    resp = HttpResponse(png, content_type="image/png")
    resp["ETag"] = etag
    # Short max-age + ETag: caches revalidate quickly (cheap 304s) so an edit or a
    # render-version bump surfaces fast, rather than serving a stale card for ages.
    resp["Cache-Control"] = "public, max-age=60, must-revalidate"
    return resp


def share_card_square(request, token):
    """600×600 square variant (WhatsApp). Same lookup/etag/throttle as card.png."""
    if _rate_limited(request):
        return _too_many()
    found = _lookup(token)
    if found is None:
        return HttpResponseGone("This share link is no longer available.")
    link, target = found
    spec = _spec_for(link, target)
    etag = _etag_for(token + ".sq", spec)
    if request.headers.get("If-None-Match") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        return resp
    png = _render_for_etag(etag, lambda: cardmod.render_square(spec))
    resp = HttpResponse(png, content_type="image/png")
    resp["ETag"] = etag
    resp["Cache-Control"] = "public, max-age=60, must-revalidate"
    return resp
