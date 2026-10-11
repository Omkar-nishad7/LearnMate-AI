from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import File


class FileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> File:
        f = File(**kwargs)
        self.db.add(f)
        await self.db.flush()
        return f

    async def get(self, file_id: int) -> Optional[File]:
        return (
            await self.db.execute(select(File).where(File.id == file_id))
        ).scalar_one_or_none()

    async def get_by_key(self, key: str, bucket: Optional[str] = None) -> Optional[File]:
        stmt = select(File).where(File.key == key)
        if bucket:
            stmt = stmt.where(File.bucket == bucket)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_for_owner(
        self,
        owner_id: int,
        *,
        bucket: Optional[str] = None,
        page: int = 1,
        page_size: int = 30,
    ) -> tuple[Sequence[File], int]:
        stmt = select(File).where(File.owner_id == owner_id)
        if bucket:
            stmt = stmt.where(File.bucket == bucket)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.db.execute(count_stmt)).scalar_one())
        stmt = stmt.order_by(File.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def total_bytes_for_owner(self, owner_id: int) -> int:
        stmt = select(func.coalesce(func.sum(File.size_bytes), 0)).where(File.owner_id == owner_id)
        return int((await self.db.execute(stmt)).scalar_one() or 0)

    async def delete(self, f: File) -> None:
        await self.db.delete(f)
        await self.db.flush()