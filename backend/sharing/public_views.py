"""Public, UNAUTHENTICATED share routes (mounted at /s/, outside /api/).

  /s/<token>           -> a branded landing page whose <head> carries the Open
                          Graph + Twitter meta that Slack/WhatsApp/etc. unfurl,
                          plus an "Open in Taskboard" deep link into the SPA.
  /s/<token>/card.png  -> the 1200×630 preview image referenced by og:image.

Both expose ONLY card metadata. Revoked / missing / deleted -> 410 Gone.
"""

from django.http import HttpResponse, HttpResponseGone
from django.shortcuts import render

from . import card as cardmod
from .describe import describe, is_live
from .models import ShareLink


# Per-process memo of rendered PNGs keyed by ETag (token + updated_at + desc
# toggle). A repeat fetch of an unchanged card skips Pillow entirely; an edit
# changes the ETag and re-renders. Bounded so it can't grow without limit.
_CARD_CACHE: dict[str, bytes] = {}
_CARD_CACHE_MAX = 256


def _render_for_etag(etag: str, spec) -> bytes:
    png = _CARD_CACHE.get(etag)
    if png is None:
        png = cardmod.render(spec)
        if len(_CARD_CACHE) >= _CARD_CACHE_MAX:
            _CARD_CACHE.clear()
        _CARD_CACHE[etag] = png
    return png


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
    found = _lookup(token)
    if found is None:
        return render(request, "sharing/gone.html", status=410)
    link, target = found
    spec = _spec_for(link, target)
    ctx = {
        "spec": spec,
        "title": spec.title,
        "description": _og_description(spec),
        "image_url": request.build_absolute_uri(f"/s/{token}/card.png"),
        "page_url": request.build_absolute_uri(f"/s/{token}"),
        "deep_link": request.build_absolute_uri(spec.deep_link),
    }
    return render(request, "sharing/unfurl.html", ctx)


def share_card(request, token):
    found = _lookup(token)
    if found is None:
        return HttpResponseGone("This share link is no longer available.")
    link, target = found
    # ETag changes when the target changes -> bots re-fetch a fresh image on edit,
    # cache otherwise. Include the desc toggle so flipping it busts the image too.
    from .describe import updated_marker

    etag = f'W/"{token}.{updated_marker(target)}.{int(link.include_description)}"'
    if request.headers.get("If-None-Match") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        return resp
    png = _render_for_etag(etag, _spec_for(link, target))
    resp = HttpResponse(png, content_type="image/png")
    resp["ETag"] = etag
    resp["Cache-Control"] = "public, max-age=300"
    return resp
