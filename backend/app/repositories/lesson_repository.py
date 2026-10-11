from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import CourseLesson


class LessonRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, lesson_id: int) -> Optional[CourseLesson]:
        res = await self.db.execute(select(CourseLesson).where(CourseLesson.id == lesson_id))
        return res.scalar_one_or_none()

    async def list_by_module(self, module_id: int) -> Sequence[CourseLesson]:
        stmt = (
            select(CourseLesson)
            .where(CourseLesson.module_id == module_id)
            .order_by(CourseLesson.order_index.asc(), CourseLesson.id.asc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def next_order_index(self, module_id: int) -> int:
        stmt = select(func.coalesce(func.max(CourseLesson.order_index), -1)).where(
            CourseLesson.module_id == module_id
        )
        return int((await self.db.execute(stmt)).scalar_one()) + 1

    async def order_index_taken(self, module_id: int, order_index: int, exclude_id: Optional[int] = None) -> bool:
        stmt = select(CourseLesson.id).where(
            CourseLesson.module_id == module_id,
            CourseLesson.order_index == order_index,
        )
        if exclude_id is not None:
            stmt = stmt.where(CourseLesson.id != exclude_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def create(self, module_id: int, data: dict) -> CourseLesson:
        lesson = CourseLesson(module_id=module_id, **data)
        self.db.add(lesson)
        await self.db.flush()
        return lesson

    async def update(self, lesson: CourseLesson, data: dict) -> CourseLesson:
        for k, v in data.items():
            if v is not None:
                setattr(lesson, k, v)
        await self.db.flush()
        return lesson

    async def delete(self, lesson: CourseLesson) -> None:
        await self.db.delete(lesson)
        await self.db.flush()