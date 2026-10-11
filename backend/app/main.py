from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from redis.asyncio import Redis
from sqlalchemy import text

from app.api.v1 import api_router
from app.config.logging import configure_logging, get_logger
from app.config.settings import settings
from app.core.monitoring import init_sentry
from app.db.session import async_engine
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_id import RequestIDMiddleware


# ============================================================
# Application initialization
# ============================================================

configure_logging()
init_sentry()

logger = get_logger("main")


# ============================================================
# Application lifespan
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.
    """

    logger.info(
        "app_startup",
        env=settings.ENVIRONMENT,
        app=settings.APP_NAME,
    )

    yield

    # Close database connections cleanly
    await async_engine.dispose()

    logger.info("app_shutdown")


# ============================================================
# FastAPI application
# ============================================================

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="LearnMate AI — AI-powered adaptive learning platform",

    # Hide API documentation in production
    docs_url=(
        "/docs"
        if settings.ENVIRONMENT != "production"
        else None
    ),

    redoc_url=(
        "/redoc"
        if settings.ENVIRONMENT != "production"
        else None
    ),

    openapi_url=(
        "/openapi.json"
        if settings.ENVIRONMENT != "production"
        else None
    ),

    lifespan=lifespan,
)


# ============================================================
# Middleware
# ============================================================

# Request ID
app.add_middleware(RequestIDMiddleware)

# Compress larger responses
app.add_middleware(
    GZipMiddleware,
    minimum_size=500,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# ============================================================
# Exception handlers
# ============================================================

register_exception_handlers(app)


# ============================================================
# API routes
# ============================================================

# All application API endpoints:
#
# /api/v1/auth/...
# /api/v1/users/...
# /api/v1/courses/...
# /api/v1/enrollments/...
# /api/v1/...
#
app.include_router(
    api_router,
    prefix=settings.API_V1_PREFIX,
)


# ============================================================
# Health endpoints
# ============================================================

@app.get("/health/live", tags=["health"])
async def live():
    """
    Kubernetes/Docker liveness check.

    This endpoint only confirms that the application process
    is running.
    """
    return {
        "status": "ok"
    }


@app.get("/health/ready", tags=["health"])
async def ready():
    """
    Readiness check.

    Verifies that:
    - MySQL is reachable
    - Redis is reachable
    """

    checks = {}
    ok = True

    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

        checks["db"] = "ok"

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "database_health_check_failed",
            error=str(exc),
        )

        checks["db"] = f"error: {exc}"
        ok = False

    # --------------------------------------------------------
    # Redis
    # --------------------------------------------------------

    try:
        redis = Redis.from_url(
            settings.REDIS_URL
        )

        await redis.ping()
        await redis.aclose()

        checks["redis"] = "ok"

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "redis_health_check_failed",
            error=str(exc),
        )

        checks["redis"] = f"error: {exc}"
        ok = False

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    return {
        "status": "ok" if ok else "degraded",
        "checks": checks,
    }


# ============================================================
# Root endpoint
# ============================================================

@app.get("/", tags=["system"])
async def root():
    """
    Basic backend information.

    Frontend is NOT served by FastAPI.
    """

    return {
        "name": settings.APP_NAME,
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "api": settings.API_V1_PREFIX,
    }