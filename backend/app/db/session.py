from pathlib import Path
from typing import AsyncGenerator
import os
import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.config.settings import settings

_CA_PATH = Path(os.getenv("DB_SSL_CA", "/app/certs/aiven-ca.pem"))
_IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")
_IS_PRODUCTION = str(getattr(settings, "ENVIRONMENT", "")).lower() == "production"


def _tls_settings():
    if _IS_SQLITE:
        return None
    if not _CA_PATH.is_file():
        if _IS_PRODUCTION:
            raise RuntimeError(
                f"Database TLS CA certificate not found at {_CA_PATH}; "
                "include the Aiven CA certificate before starting production."
            )
        return None
    async_ssl = ssl.create_default_context(cafile=str(_CA_PATH))
    sync_ssl = {"ca": str(_CA_PATH), "check_hostname": True}
    return async_ssl, sync_ssl


_tls = _tls_settings()
_engine_kwargs = {"echo": settings.DEBUG, "pool_pre_ping": True}
if not _IS_SQLITE:
    _engine_kwargs.update(pool_size=10, max_overflow=20)
if _tls is not None:
    _engine_kwargs["connect_args"] = {"ssl": _tls[0]}

async_engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)

_sync_kwargs = {"echo": settings.DEBUG, "pool_pre_ping": True}
if _tls is not None:
    _sync_kwargs["connect_args"] = {
        "ssl": _tls[1], "ssl_verify_cert": True, "ssl_verify_identity": True
    }
sync_engine = create_engine(settings.DATABASE_SYNC_URL, **_sync_kwargs)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
