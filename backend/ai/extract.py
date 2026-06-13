"""Pull plain text out of uploaded documents for the AI task generator.

Text formats (PDF / Word / txt / md) are extracted to a string here; images are
NOT handled here — they go to the model as vision blocks (see generator.py) and
are stored as attachments. Unsupported types return "" and the caller skips them.
"""

import io

TEXT_EXT = (".pdf", ".docx", ".txt", ".md")
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")
IMAGE_MEDIA = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif",
}


def _ext(filename: str) -> str:
    name = (filename or "").lower()
    return name[name.rfind("."):] if "." in name else ""


def is_image(filename: str) -> bool:
    return _ext(filename) in IMAGE_EXT


def is_supported(filename: str) -> bool:
    return _ext(filename) in TEXT_EXT or is_image(filename)


def image_media_type(filename: str) -> str:
    return IMAGE_MEDIA.get(_ext(filename), "image/png")


def extract_text(filename: str, data: bytes) -> str:
    """Best-effort text from a document. Never raises on a bad file — returns ""."""
    ext = _ext(filename)
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if ext == ".docx":
            import docx
            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs).strip()
        if ext in (".txt", ".md"):
            return data.decode("utf-8", errors="replace").strip()
    except Exception:
        return ""
    return ""
