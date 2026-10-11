from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Enrollment, EnrollmentStatus, Course


class EnrollmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, student_id: int, course_id: int) -> Optional[Enrollment]:
        stmt = select(Enrollment).where(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(self, student_id: int, course_id: int) -> Enrollment:
        enr = Enrollment(
            student_id=student_id,
            course_id=course_id,
            status=EnrollmentStatus.ACTIVE,
            progress_percent=0.0,
            enrolled_at=datetime.now(timezone.utc),
        )
        self.db.add(enr)
        await self.db.flush()
        return enr

    async def list_for_student(
        self,
        student_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[tuple[Enrollment, Course]], int]:
        stmt = (
            select(Enrollment, Course)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Enrollment.student_id == student_id)
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Enrollment.enrolled_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).all()
        return rows, total

    async def list_students_for_course(
        self,
        course_id: int,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[Sequence[Enrollment], int]:
        stmt = select(Enrollment).where(Enrollment.course_id == course_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = stmt.order_by(Enrollment.enrolled_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def update_status(self, enr: Enrollment, status: EnrollmentStatus) -> Enrollment:
        enr.status = status
        if status == EnrollmentStatus.COMPLETED:
            enr.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return enr

    async def update_progress(self, enr: Enrollment, percent: float) -> Enrollment:
        enr.progress_percent = max(0.0, min(100.0, percent))
        if enr.progress_percent >= 100.0 and enr.status == EnrollmentStatus.ACTIVE:
            enr.status = EnrollmentStatus.COMPLETED
            enr.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return enr