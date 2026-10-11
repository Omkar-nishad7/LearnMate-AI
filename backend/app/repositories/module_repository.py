from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseModule


class ModuleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, module_id: int) -> Optional[CourseModule]:
        res = await self.db.execute(select(CourseModule).where(CourseModule.id == module_id))
        return res.scalar_one_or_none()

    async def list_by_course(self, course_id: int, with_lessons: bool = False) -> Sequence[CourseModule]:
        stmt = select(CourseModule).where(CourseModule.course_id == course_id)
        if with_lessons:
            stmt = stmt.options(selectinload(CourseModule.lessons))
        stmt = stmt.order_by(CourseModule.order_index.asc(), CourseModule.id.asc())
        return (await self.db.execute(stmt)).scalars().all()

    async def next_order_index(self, course_id: int) -> int:
        stmt = select(func.coalesce(func.max(CourseModule.order_index), -1)).where(
            CourseModule.course_id == course_id
        )
        return int((await self.db.execute(stmt)).scalar_one()) + 1

    async def order_index_taken(self, course_id: int, order_index: int, exclude_id: Optional[int] = None) -> bool:
        stmt = select(CourseModule.id).where(
            CourseModule.course_id == course_id,
            CourseModule.order_index == order_index,
        )
        if exclude_id is not None:
            stmt = stmt.where(CourseModule.id != exclude_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def create(self, course_id: int, data: dict) -> CourseModule:
        module = CourseModule(course_id=course_id, **data)
        self.db.add(module)
        await self.db.flush()
        return module

    async def update(self, module: CourseModule, data: dict) -> CourseModule:
        for k, v in data.items():
            if v is not None:
                setattr(module, k, v)
        await self.db.flush()
        return module

    async def delete(self, module: CourseModule) -> None:
        await self.db.delete(module)
        await self.db.flush()