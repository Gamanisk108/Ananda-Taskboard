# Generates the PWA/app icons from the REAL brand mark (public/logo.png).
# Asset-integrity rule: the mark is only ever DOWNSCALED (never upscaled);
# the 512 maskable icon composes the native-size mark on a brand-navy canvas.
# Run: backend/venv/Scripts/python.exe frontend/scripts/make-icons.py
from PIL import Image
from pathlib import Path

PUB = Path(__file__).resolve().parents[1] / "public"
NAVY = (30, 58, 110, 255)  # --primary #1e3a6e (manifest theme_color)

mark = Image.open(PUB / "logo.png").convert("RGBA")  # 310x291


def fit(img: Image.Image, box: int) -> Image.Image:
    """Downscale img to fit in box x box (LANCZOS), keep aspect."""
    r = min(box / img.width, box / img.height)
    assert r <= 1, "refusing to upscale the brand mark"
    return img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)


def on_canvas(size: int, content: Image.Image, bg=(0, 0, 0, 0)) -> Image.Image:
    c = Image.new("RGBA", (size, size), bg)
    c.alpha_composite(content, ((size - content.width) // 2, (size - content.height) // 2))
    return c


# 192 "any": mark downscaled, transparent padding to square.
on_canvas(192, fit(mark, 186)).save(PUB / "pwa-192.png")
# 180 apple-touch-icon: iOS composes its own mask; give it a navy full-bleed tile.
on_canvas(180, fit(mark, 150), NAVY).save(PUB / "apple-touch-icon.png")
# 512 "any" + maskable: navy canvas, native-size mark (310px) inside the 80% safe zone.
on_canvas(512, mark, NAVY).save(PUB / "pwa-512.png")
print("icons written:", [p.name for p in PUB.glob("pwa-*.png")] + ["apple-touch-icon.png"])
