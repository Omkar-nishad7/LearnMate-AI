import pytest
from unittest.mock import AsyncMock, patch

from app.services.ai.usage import check_and_increment, log_usage


@pytest.mark.asyncio
async def test_check_and_increment_bypassed_in_tests():
    # ENVIRONMENT=test → no Redis call, no error
    await check_and_increment("tutor", 1)


@pytest.mark.asyncio
async def test_log_usage_writes_row(db_session=None):
    # Use a real async session from test conftest via direct import
    from tests.conftest import TestSession
    async with TestSession() as db:
        await log_usage(db, user_id=1, feature="tutor", status="SUCCESS", tokens_used=42)
        await db.commit()
        from sqlalchemy import select
        from app.models.audit import AIUsageLog
        row = (await db.execute(select(AIUsageLog))).scalar_one()
        assert row.tokens_used == 42
        assert row.feature == "tutor"
