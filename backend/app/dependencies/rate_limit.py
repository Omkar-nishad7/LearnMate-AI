from __future__ import annotations

import time
from typing import Callable

from fastapi import Request
from redis.asyncio import Redis

from app.config.settings import settings
from app.core.exceptions import RateLimitError

_redis_client: Redis | None = None


def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def rate_limit(
    key_prefix: str,
    max_requests: int,
    window_seconds: int,
    by: str = "ip",
) -> Callable:
    """
    Sliding-window counter using Redis INCR + EXPIRE.
    `by`: "ip" (default) or "user" (requires auth to have run and set request.state.user_id).
    """

    async def _dependency(request: Request) -> None:
        if settings.ENVIRONMENT == "test":
            return  # disable in tests
        if by == "user":
            ident = getattr(request.state, "user_id", None)
            if ident is None:
                # fall back to IP if user unknown
                ident = request.client.host if request.client else "unknown"
        else:
            ident = request.client.host if request.client else "unknown"

        bucket = int(time.time() // window_seconds)
        key = f"rl:{key_prefix}:{ident}:{bucket}"

        client = get_redis()
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, window_seconds + 1)
        except Exception:
            # Fail-open on Redis outage — better than locking users out.
            return

        if count > max_requests:
            ttl = await client.ttl(key)
            raise RateLimitError(
                f"Rate limit exceeded. Try again in {max(ttl, 1)}s."
            )

    return _dependency