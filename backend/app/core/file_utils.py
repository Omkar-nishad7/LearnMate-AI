import hashlib
import mimetypes
import os
import re
import unicodedata
from typing import Optional

# Categories and their allowed content types
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
DOC_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/ogg"}

CATEGORY_ALLOWED = {
    "image": IMAGE_TYPES,
    "document": DOC_TYPES,
    "video": VIDEO_TYPES,
    "audio": AUDIO_TYPES,
    "pdf": {"application/pdf"},
    "any": IMAGE_TYPES | DOC_TYPES | VIDEO_TYPES | AUDIO_TYPES,
}

CATEGORY_MAX_BYTES = {
    "image": 10 * 1024 * 1024,            # 10 MB
    "document": 25 * 1024 * 1024,         # 25 MB
    "pdf": 25 * 1024 * 1024,
    "video": 500 * 1024 * 1024,           # 500 MB
    "audio": 100 * 1024 * 1024,
    "any": 50 * 1024 * 1024,
}

_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str, max_len: int = 120) -> str:
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    base = os.path.basename(name)
    base = _SAFE_RE.sub("_", base).strip("._-") or "file"
    if len(base) > max_len:
        stem, ext = os.path.splitext(base)
        base = stem[: max_len - len(ext)] + ext
    return base


def guess_mime(filename: str, fallback: str = "application/octet-stream") -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or fallback


def sniff_mime(header: bytes, filename: str) -> str:
    """
    Lightweight signature sniff for common cases.
    Falls back to extension-based guess.
    """
    if header.startswith(b"%PDF-"):
        return "application/pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return "image/gif"
    if header[4:12] == b"ftypisom" or header[4:12] == b"ftypmp42":
        return "video/mp4"
    if header.startswith(b"RIFF") and header[8:12] == b"WAVE":
        return "audio/wav"
    if header.startswith(b"ID3") or header[:2] == b"\xff\xfb":
        return "audio/mpeg"
    return guess_mime(filename)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_category(category: str, mime: str, size: int) -> None:
    from app.core.exceptions import ValidationError
    if category not in CATEGORY_ALLOWED:
        raise ValidationError(f"Unknown category: {category}")
    allowed = CATEGORY_ALLOWED[category]
    if mime not in allowed:
        raise ValidationError(
            f"Content type {mime!r} not allowed for category {category!r}"
        )
    limit = CATEGORY_MAX_BYTES[category]
    if size > limit:
        raise ValidationError(
            f"File too large: {size} bytes (max {limit} for {category})"
        )


def build_storage_key(
    *,
    owner_id: int,
    category: str,
    filename: str,
    suffix: Optional[str] = None,
) -> str:
    """Deterministic-ish key layout: users/{id}/{category}/{hash-prefix}-{name}."""
    safe = safe_filename(filename)
    if suffix:
        stem, ext = os.path.splitext(safe)
        safe = f"{stem}-{suffix}{ext}"
    h = hashlib.sha1(f"{owner_id}:{category}:{safe}:{os.urandom(6).hex()}".encode()).hexdigest()[:10]
    return f"users/{owner_id}/{category}/{h}-{safe}"