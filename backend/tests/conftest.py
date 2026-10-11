import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "x" * 32)
os.environ.setdefault("JWT_SECRET_KEY", "y" * 32)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("DATABASE_SYNC_URL", "sqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from sqlalchemy import BigInteger, Integer
from app.db.base import Base
from app.db.session import get_db
import app.models  # noqa: F401 — register models

# In SQLite, autoincrement only works on INTEGER PRIMARY KEY, not BIGINT
for table in Base.metadata.tables.values():
    for col in table.columns:
        if col.primary_key and isinstance(col.type, BigInteger):
            col.type = Integer()

from app.main import app


test_engine = create_async_engine("sqlite+aiosqlite:///./test.db", echo=False)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


async def _get_test_db():
    async with TestSession() as s:
        try:
            yield s
        except Exception:
            await s.rollback()
            raise


app.dependency_overrides[get_db] = _get_test_db


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac