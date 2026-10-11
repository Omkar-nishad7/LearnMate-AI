from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.progress import Progress, LearningActivity


class ProgressRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_for_lesson(self, student_id: int, lesson_id: int) -> Optional[Progress]:
        return (
            await self.db.execute(
                select(Progress).where(
                    Progress.student_id == student_id, Progress.lesson_id == lesson_id
                )
            )
        ).scalar_one_or_none()

    async def upsert(
        self,
        *,
        student_id: int,
        course_id: int,
        lesson_id: Optional[int],
        video_id: Optional[int],
        is_completed: bool,
        progress_percent: float,
        last_position_seconds: Optional[int],
    ) -> Progress:
        row: Optional[Progress] = None
        if lesson_id is not None:
            row = await self.get_for_lesson(student_id, lesson_id)
        if row is None:
            row = Progress(
                student_id=student_id,
                course_id=course_id,
                lesson_id=lesson_id,
                video_id=video_id,
                is_completed=is_completed,
                progress_percent=progress_percent,
                last_position_seconds=last_position_seconds,
            )
            self.db.add(row)
        else:
            row.is_completed = is_completed or row.is_completed
            row.progress_percent = max(row.progress_percent, progress_percent)
            row.last_position_seconds = last_position_seconds
            if is_completed and row.completed_at is None:
                row.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return row

    async def count_completed_lessons(self, student_id: int, course_id: int) -> int:
        stmt = select(func.count()).select_from(
            select(Progress)
            .where(
                Progress.student_id == student_id,
                Progress.course_id == course_id,
                Progress.lesson_id.is_not(None),
                Progress.is_completed.is_(True),
            )
            .subquery()
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def list_for_course(self, student_id: int, course_id: int) -> Sequence[Progress]:
        return (
            await self.db.execute(
                select(Progress).where(
                    Progress.student_id == student_id, Progress.course_id == course_id
                )
            )
        ).scalars().all()

    async def course_avg_progress(self, course_id: int) -> float:
        stmt = select(func.coalesce(func.avg(Progress.progress_percent), 0.0)).where(
            Progress.course_id == course_id
        )
        return float((await self.db.execute(stmt)).scalar_one())


class LearningActivityRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record(
        self,
        *,
        student_id: int,
        activity_type: str,
        course_id: Optional[int] = None,
        lesson_id: Optional[int] = None,
        video_id: Optional[int] = None,
        duration_seconds: Optional[int] = None,
        completed: bool = False,
        score: Optional[float] = None,
        metadata: Optional[dict] = None,
    ) -> LearningActivity:
        ev = LearningActivity(
            student_id=student_id,
            course_id=course_id,
            lesson_id=lesson_id,
            video_id=video_id,
            activity_type=activity_type,
            duration_seconds=duration_seconds,
            completed=completed,
            score=score,
            metadata_json=metadata,
        )
        self.db.add(ev)
        await self.db.flush()
        return ev

    async def recent_count(self, student_id: int, days: int = 7) -> int:
        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = select(func.count()).select_from(
            select(LearningActivity)
            .where(
                LearningActivity.student_id == student_id,
                LearningActivity.created_at >= since,
            )
            .subquery()
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def distinct_active_days(self, student_id: int, limit_days: int = 400) -> Sequence[str]:
        """Returns ISO dates (UTC) on which the student had any activity, newest first."""
        stmt = (
            select(func.date(LearningActivity.created_at))
            .where(LearningActivity.student_id == student_id)
            .group_by(func.date(LearningActivity.created_at))
            .order_by(func.date(LearningActivity.created_at).desc())
            .limit(limit_days)
        )
        rows = (await self.db.execute(stmt)).all()
        return [str(r[0]) for r in rows]

    async def last_activity_at(self, student_id: int):
        stmt = select(func.max(LearningActivity.created_at)).where(
            LearningActivity.student_id == student_id
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def last_activity_for_course(self, student_id: int, course_id: int):
        stmt = select(func.max(LearningActivity.created_at)).where(
            LearningActivity.student_id == student_id,
            LearningActivity.course_id == course_id,
        )
        return (await self.db.execute(stmt)).scalar_one()