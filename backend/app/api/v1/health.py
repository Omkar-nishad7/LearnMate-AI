from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from app.db.session import get_db
from app.config.settings import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENVIRONMENT}


@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "dependency": "database"}
    except Exception as e:
        return {"status": "error", "dependency": "database", "error": str(e)}


@router.get("/health/redis")
async def health_redis():
    try:
        client = Redis.from_url(settings.REDIS_URL)
        await client.ping()
        await client.aclose()
        return {"status": "ok", "dependency": "redis"}
    except Exception as e:
        return {"status": "error", "dependency": "redis", "error": str(e)}