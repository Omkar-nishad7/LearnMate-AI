from datetime import datetime, timezone
from typing import Optional

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.ai_exceptions import AIRateLimitedError
from app.models.audit import AIUsageLog


# ---------------- Rate limiting ----------------

# feature -> (limit/day, env setting name for override)
_FEATURE_LIMIT_RESOLVERS = {
    "tutor": lambda: settings.AI_LIMIT_TUTOR_PER_DAY,
    "video_analysis": lambda: settings.AI_LIMIT_VIDEO_PER_DAY,
    "quiz": lambda: settings.AI_LIMIT_QUIZ_PER_DAY,
    "notes": lambda: settings.AI_LIMIT_NOTES_PER_DAY,
    "teacher": lambda: settings.AI_LIMIT_TEACHER_PER_DAY,
}

_redis: Optional[Redis] = None


def _client() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


def _today_key(feature: str, user_id: int) -> str:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"ai:usage:{feature}:{user_id}:{day}"


async def check_and_increment(feature: str, user_id: int) -> None:
    """Fail-open on Redis outage. Tests bypass via ENVIRONMENT=test."""
    if settings.ENVIRONMENT == "test":
        return
    resolver = _FEATURE_LIMIT_RESOLVERS.get(feature)
    limit = resolver() if resolver else 100
    key = _today_key(feature, user_id)
    try:
        count = await _client().incr(key)
        if count == 1:
            # expire just after midnight UTC
            await _client().expire(key, 90000)
        if count > limit:
            raise AIRateLimitedError(
                f"Daily limit of {limit} reached for '{feature}'"
            )
    except AIRateLimitedError:
        raise
    except Exception:
        # Fail-open on infrastructure errors
        return


async def remaining(feature: str, user_id: int) -> int:
    resolver = _FEATURE_LIMIT_RESOLVERS.get(feature)
    limit = resolver() if resolver else 100
    try:
        val = await _client().get(_today_key(feature, user_id))
        used = int(val) if val else 0
    except Exception:
        used = 0
    return max(limit - used, 0)


# ---------------- Usage logging ----------------

async def log_usage(
    db: AsyncSession,
    *,
    user_id: int,
    feature: str,
    status: str = "SUCCESS",
    tokens_used: Optional[int] = None,
    error_message: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    db.add(
        AIUsageLog(
            user_id=user_id,
            feature=feature,
            request_count=1,
            tokens_used=tokens_used,
            status=status,
            error_message=(error_message or "")[:500] or None,
            metadata_json=metadata,
        )
    )
    await db.flush()