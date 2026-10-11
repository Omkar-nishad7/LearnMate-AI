import re
from typing import Optional, Sequence
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.user import User

from app.models.course import Course, CourseModule, CourseStatus


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:200] or "course"


class CourseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, course_id: int, with_modules: bool = False) -> Optional[Course]:
        stmt = select(Course).where(Course.id == course_id)
        if with_modules:
            stmt = stmt.options(selectinload(Course.modules))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Course]:
        res = await self.db.execute(select(Course).where(Course.slug == slug))
        return res.scalar_one_or_none()

    async def slug_exists(self, slug: str) -> bool:
        res = await self.db.execute(select(Course.id).where(Course.slug == slug))
        return res.scalar_one_or_none() is not None

    async def unique_slug(self, base: str) -> str:
        candidate = slugify(base)
        suffix = 1
        while await self.slug_exists(candidate):
            suffix += 1
            candidate = f"{slugify(base)}-{suffix}"
        return candidate

    async def create(self, teacher_id: int, data: dict) -> Course:
        slug = await self.unique_slug(data["title"])
        course = Course(
            teacher_id=teacher_id,
            slug=slug,
            status=CourseStatus.DRAFT,
            **data,
        )
        self.db.add(course)
        await self.db.flush()
        return course

    async def update(self, course: Course, data: dict) -> Course:
        for k, v in data.items():
            if v is not None:
                setattr(course, k, v)
        await self.db.flush()
        return course

    async def delete(self, course: Course) -> None:
        await self.db.delete(course)
        await self.db.flush()

    # ---- Catalog queries ----
    async def list_teacher(
        self,
        teacher_id: int,
        *,
        status: Optional[CourseStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[Course], int]:
        base = select(Course).where(Course.teacher_id == teacher_id)
        if status:
            base = base.where(Course.status == status)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            base.order_by(Course.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def list_public(
        self,
        *,
        q: Optional[str] = None,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        language: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[Course], int]:
        stmt = (
            select(Course)
            .options(selectinload(Course.teacher).selectinload(User.profile))
            .where(Course.status == CourseStatus.PUBLISHED)
        )
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    Course.title.like(like),
                    Course.short_description.like(like),
                    Course.description.like(like),
                    Course.category.like(like),
                    Course.difficulty.like(like),
                    Course.language.like(like),
                )
            )
        if category:
            stmt = stmt.where(Course.category == category)
        if difficulty:
            stmt = stmt.where(Course.difficulty == difficulty)
        if language:
            stmt = stmt.where(Course.language == language)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(
            func.coalesce(Course.published_at, Course.updated_at, Course.created_at).desc()
        )
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def get_with_modules_and_lessons(self, course_id: int) -> Optional[Course]:
        stmt = (
            select(Course)
            .options(selectinload(Course.modules).selectinload(CourseModule.lessons))
            .where(Course.id == course_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()