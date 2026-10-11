"""Check both database drivers without modifying data."""
import asyncio
from sqlalchemy import text
from app.db.session import async_engine, sync_engine


def check_sync_connection():
    with sync_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    print("Synchronous database connection (pymysql): OK")


async def check_async_connection():
    async with async_engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    print("Asynchronous database connection (asyncmy): OK")


async def main():
    try:
        check_sync_connection()
        await check_async_connection()
    finally:
        sync_engine.dispose()
        await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
