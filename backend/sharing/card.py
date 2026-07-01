"""Render a 1200×630 share-preview PNG for any shareable object.

Pillow + bundled variable TTFs (Instrument Sans + Red Hat Mono) — chosen over
SVG→PNG or headless-Chrome because FreeType reads the bundled fonts directly,
so output is byte-deterministic on Render with zero system-font dependency and
no browser memory cost. 1200×630 is the og:image `summary_large_image` standard.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from . import brand


@dataclass
class CardSpec:
    """Everything the card image + OG meta need, uniform across all four entity
    types. Built by describe.py from a model instance; the renderer is ORM-free."""

    kind: str                       # "Task" | "Sub-task" | "Project" | "Sub-project"
    title: str
    breadcrumb: str = ""            # "Project ▸ Sub-Project"
    description: str = ""           # raw; the caller decides whether to show it
    priority: int | None = None     # 1-5 for tasks/subtasks, else None
    status: str | None = None       # Status.key for tasks/subtasks, else None
    assignees: list[str] = field(default_factory=list)
    accent: str = "#1e3a6e"         # left rail color (project/sub-project color, else navy)
    deep_link: str = "/"            # in-app path using the existing ?task/?project/?sub scheme

FONTS = Path(__file__).resolve().parent / "fonts"
_INSTRUMENT = str(FONTS / "InstrumentSans-VF.ttf")
_MONO = str(FONTS / "RedHatMono-VF.ttf")

# Bump whenever the card RENDERING changes (layout, the integrated accent edge,
# fonts, colors…) even if the task DATA is identical — the ETag folds this in so
# every browser/CDN cache invalidates on a render change, not just a data change.
RENDER_VERSION = 5

W, H = 1200, 630
MARGIN = 48
PAD_X = 72          # inner content padding from the panel edge
RAIL_W = 14         # left accent rail width


@lru_cache(maxsize=64)
def _font(family: str, size: int, weight: int) -> ImageFont.FreeTypeFont:
    """A sized, weighted font. Variable-axis order differs per family:
    Instrument Sans = [Width, Weight]; Red Hat Mono = [Weight]."""
    path = _INSTRUMENT if family == "ui" else _MONO
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_axes([100, weight] if family == "ui" else [weight])
    except Exception:  # pragma: no cover - non-variable fallback
        pass
    return f


def _truncate(draw, text: str, font, max_w: int) -> str:
    """Single line, ellipsized to fit max_w."""
    text = " ".join((text or "").split())
    if not text or draw.textlength(text, font=font) <= max_w:
        return text
    ell = "…"
    while text and draw.textlength(text + ell, font=font) > max_w:
        text = text[:-1]
    return text.rstrip() + ell


def _wrap(draw, text: str, font, max_w: int, max_lines: int) -> list[str]:
    """Word-wrap into at most max_lines, ellipsizing the last if it overflows."""
    text = " ".join((text or "").split())
    if not text:
        return []
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines:
        # If content remains, ellipsize the final line.
        consumed = " ".join(lines)
        if len(consumed) < len(text):
            lines[-1] = _truncate(draw, lines[-1] + " …more", font, max_w)
    # Safety net: a single unbreakable word longer than max_w would otherwise
    # draw off-canvas — char-truncate any line that still overflows.
    return [_truncate(draw, ln, font, max_w) for ln in lines]


def _rounded(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=radius, **kw)


def _draw_chevron(draw, x0, y0, size, polylines, rgb):
    """Draw the app's PriorityIcon chevron (14×14 viewBox points) scaled to `size`,
    with ROUNDED caps + joints (Pillow's joint='curve' only kicks in for width>4,
    so round them explicitly with a dot at each vertex — matches the app's
    stroke-linecap/linejoin='round')."""
    sc = size / 14.0
    w = max(2, round(size / 7))
    r = w / 2
    for pl in polylines:
        pts = [(x0 + float(a) * sc, y0 + float(b) * sc)
               for a, b in (p.split(",") for p in pl.split())]
        draw.line(pts, fill=rgb, width=w)
        for px, py in pts:
            draw.ellipse([px - r, py - r, px + r, py + r], fill=rgb)


def _chip(draw, x, y, label, color_hex, font, chevron=None) -> int:
    """A pill: soft tinted bg + a colored dot (or a priority chevron) + label.
    Returns its right edge x."""
    rgb = brand.hex_to_rgb(color_hex)
    th = 52
    icon_w = 22 if chevron else 14   # chevron box vs dot diameter
    text_w = draw.textlength(label, font=font)
    pad = 22
    w = int(pad + icon_w + 12 + text_w + pad)
    bg = tuple(round(s * 0.86 + c * 0.14) for s, c in zip(brand.SURFACE, rgb))  # 14% tint
    _rounded(draw, [x, y, x + w, y + th], radius=th // 2, fill=bg,
             outline=tuple(round(s * 0.7 + c * 0.3) for s, c in zip(brand.SURFACE, rgb)), width=1)
    cy = y + th // 2
    if chevron:
        _draw_chevron(draw, x + pad, cy - icon_w / 2, icon_w, chevron, rgb)
    else:
        draw.ellipse([x + pad, cy - 7, x + pad + 14, cy + 7], fill=rgb)
    draw.text((x + pad + icon_w + 12, cy), label, font=font, fill=rgb, anchor="lm")
    return x + w


def _initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (name.strip()[:2] or "?").upper()


def _name_color(name: str) -> tuple[int, int, int]:
    """Stable, distinct per-person avatar color (golden-angle hue, mid tone) so
    assignees never all render the same. Name-hashed since the card has no user id."""
    import colorsys
    hue = (sum((i + 1) * ord(c) for i, c in enumerate(name)) % 360) / 360.0
    r, g, b = colorsys.hls_to_rgb(hue, 0.42, 0.52)
    return (round(r * 255), round(g * 255), round(b * 255))


def render(spec: CardSpec) -> bytes:
    """Render `spec` to PNG bytes."""
    img = Image.new("RGB", (W, H), brand.BG)
    d = ImageDraw.Draw(img)
    accent = brand.hex_to_rgb(spec.accent)

    # Surface panel.
    panel = [MARGIN, MARGIN, W - MARGIN, H - MARGIN]
    _rounded(d, panel, radius=28, fill=brand.SURFACE, outline=brand.BORDER, width=2)
    # Accent left edge — CLIPPED to the card's rounded rectangle so it reads as
    # the card's own colored left edge (sharing the top-left/bottom-left corners,
    # straight inner edge), not a separate pill floating beside the card.
    card_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(card_mask).rounded_rectangle(panel, radius=28, fill=255)
    strip_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(strip_mask).rectangle([MARGIN, MARGIN, MARGIN + RAIL_W, H - MARGIN], fill=255)
    strip_mask = ImageChops.multiply(strip_mask, card_mask)
    img.paste(Image.new("RGB", (W, H), accent), (0, 0), strip_mask)

    left = MARGIN + RAIL_W + PAD_X
    right = W - MARGIN - PAD_X
    content_w = right - left
    y = MARGIN + 56

    # Kind eyebrow (mono, uppercase) + brand mark on the right.
    # NOTE: sizes/weights here are tuned for LEGIBILITY WHEN DOWNSCALED — chat
    # clients (Slack ~360px) shrink this 1200px card ~3×, and thin/small text
    # blurs. Secondary text is heavier + larger than the in-app equivalents.
    eyebrow = _font("mono", 28, 700)
    d.text((left, y), spec.kind.upper(), font=eyebrow, fill=accent, anchor="lm")
    brand_f = _font("ui", 28, 600)
    d.text((right, y), "Ananda Taskboard", font=brand_f, fill=brand.MUTED, anchor="rm")
    y += 46

    # Breadcrumb.
    if spec.breadcrumb:
        crumb_f = _font("ui", 30, 600)
        d.text((left, y), _truncate(d, spec.breadcrumb, crumb_f, content_w),
               font=crumb_f, fill=brand.MUTED, anchor="lm")
        y += 52
    else:
        y += 8

    # Title (up to 2 lines).
    title_f = _font("ui", 60, 700)
    title_lines = _wrap(d, spec.title or "Untitled", title_f, content_w, 2)
    for line in title_lines:
        d.text((left, y), line, font=title_f, fill=brand.INK, anchor="lm")
        y += 74
    y += 18

    # Chips: priority + status (tasks/sub-tasks only).
    chip_f = _font("ui", 29, 700)
    chip_x = left
    drew_chip = False
    if spec.priority in brand.PRIORITY:
        plabel, pcolor = brand.PRIORITY[spec.priority]
        chevron = brand.PRIORITY_CHEVRON.get(spec.priority)
        chip_x = _chip(d, chip_x, y, f"{plabel} priority", pcolor, chip_f, chevron=chevron) + 16
        drew_chip = True
    if spec.status in brand.STATUS:
        slabel, scolor = brand.STATUS[spec.status]
        chip_x = _chip(d, chip_x, y, slabel, scolor, chip_f) + 16
        drew_chip = True
    if drew_chip:
        y += 78

    # Description (optional, up to 2 lines). Weight 500 + darker than --muted so
    # it stays crisp and readable after the chat client downscales the card.
    if spec.description:
        desc_f = _font("ui", 31, 500)
        for line in _wrap(d, spec.description, desc_f, content_w, 2):
            d.text((left, y), line, font=desc_f, fill=(58, 64, 78), anchor="lm")
            y += 46

    # Footer: assignees (bottom-left).
    foot_y = H - MARGIN - 56
    if spec.assignees:
        ax = left
        av_f = _font("ui", 22, 600)
        shown = spec.assignees[:3]
        for i, name in enumerate(shown):
            cx = ax + i * 44
            r = 22
            d.ellipse([cx, foot_y - r, cx + r * 2, foot_y + r], fill=_name_color(name),
                      outline=brand.SURFACE, width=3)
            d.text((cx + r, foot_y), _initials(name), font=av_f, fill=brand.WHITE, anchor="mm")
        label_x = ax + (len(shown) - 1) * 44 + 56
        extra = len(spec.assignees) - len(shown)
        names = ", ".join(shown) + (f" +{extra}" if extra > 0 else "")
        name_f = _font("ui", 29, 600)
        d.text((label_x, foot_y), _truncate(d, names, name_f, right - label_x),
               font=name_f, fill=(58, 64, 78), anchor="lm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
