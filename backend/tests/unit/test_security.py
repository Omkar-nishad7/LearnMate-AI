import pytest
from app.core.security import (
    create_access_token,
    decode_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_and_verify():
    h = hash_password("Secret123")
    assert h != "Secret123"
    assert verify_password("Secret123", h)
    assert not verify_password("wrong", h)


def test_refresh_token_hash_is_deterministic():
    raw = generate_refresh_token()
    assert hash_refresh_token(raw) == hash_refresh_token(raw)
    assert hash_refresh_token(raw) != raw


def test_access_token_roundtrip():
    t = create_access_token(subject="42", role="STUDENT")
    p = decode_token(t)
    assert p["sub"] == "42"
    assert p["role"] == "STUDENT"
    assert p["type"] == "access"


def test_access_token_tampered_fails():
    t = create_access_token(subject="42", role="STUDENT")
    with pytest.raises(Exception):
        decode_token(t + "x")