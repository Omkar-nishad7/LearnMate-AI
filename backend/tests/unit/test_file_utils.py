import pytest
from app.core.exceptions import ValidationError
from app.core.file_utils import (
    safe_filename, guess_mime, sniff_mime, sha256_bytes,
    validate_category, build_storage_key,
)


def test_safe_filename_strips_paths_and_unicode():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("héllo wörld.pdf") == "hello_world.pdf"
    assert safe_filename("") == "file"


def test_guess_mime():
    assert guess_mime("a.pdf") == "application/pdf"
    assert guess_mime("a.png") == "image/png"
    assert guess_mime("unknown.xyz", "application/octet-stream") == "application/octet-stream"


def test_sniff_mime_signatures():
    assert sniff_mime(b"%PDF-1.4 rest", "whatever.pdf") == "application/pdf"
    assert sniff_mime(b"\x89PNG\r\n\x1a\nrest", "x") == "image/png"
    assert sniff_mime(b"\xff\xd8\xff", "x.jpg") == "image/jpeg"
    assert sniff_mime(b"GIF89a...", "x.gif") == "image/gif"


def test_validate_category_accepts_pdf():
    validate_category("pdf", "application/pdf", 1024)


def test_validate_category_rejects_wrong_mime():
    with pytest.raises(ValidationError):
        validate_category("image", "application/pdf", 1024)


def test_validate_category_rejects_oversize():
    with pytest.raises(ValidationError):
        validate_category("image", "image/png", 100 * 1024 * 1024)


def test_build_storage_key_shape():
    key = build_storage_key(owner_id=7, category="document", filename="essay.pdf")
    assert key.startswith("users/7/document/")
    assert key.endswith("essay.pdf")


def test_sha256_stable():
    assert sha256_bytes(b"abc") == sha256_bytes(b"abc")