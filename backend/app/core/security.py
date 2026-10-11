import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config.settings import settings


# ---------- Password hashing (Argon2id) ----------
_pwd_ctx = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__time_cost=3,
    argon2__memory_cost=65536,   # 64 MB
    argon2__parallelism=4,
)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


def needs_rehash(hashed: str) -> bool:
    return _pwd_ctx.needs_update(hashed)


# ---------- JWT ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    subject: str,
    role: str,
    extra: Optional[dict] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = _now() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Raises JWTError on invalid/expired."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# ---------- Refresh tokens ----------
def generate_refresh_token() -> str:
    """Opaque high-entropy token sent to client. Never stored raw in DB."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(raw: str) -> str:
    """Deterministic SHA-256 hash for DB storage + lookup."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


# ---------- One-time tokens (email verify, password reset) ----------
def generate_one_time_token() -> str:
    return secrets.token_urlsafe(48)


def hash_one_time_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()