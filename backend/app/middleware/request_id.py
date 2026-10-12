import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config.logging import get_logger

logger = get_logger("request_timing")
SLOW_REQUEST_THRESHOLD_MS = 1000.0


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=round(elapsed_ms, 1),
                request_id=request_id,
                exc_info=True,
            )
            raise

        response.headers["X-Request-ID"] = request_id
        elapsed_ms = (time.perf_counter() - started) * 1000
        if elapsed_ms >= SLOW_REQUEST_THRESHOLD_MS:
            logger.warning(
                "slow_request",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(elapsed_ms, 1),
                request_id=request_id,
            )
        return response
