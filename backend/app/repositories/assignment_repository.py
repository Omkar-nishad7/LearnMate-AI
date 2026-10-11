from typing import Optional, Sequence
from sqlalchemy import case, select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignment import (
    Assignment,
    AssignmentSubmission,
    AssignmentStatus,
    SubmissionStatus,
)


class AssignmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, assignment_id: int) -> Optional[Assignment]:
        return (
            await self.db.execute(select(Assignment).where(Assignment.id == assignment_id))
        ).scalar_one_or_none()

    async def create(self, creator_id: int, data: dict) -> Assignment:
        a = Assignment(creator_id=creator_id, status=AssignmentStatus.DRAFT, **data)
        self.db.add(a)
        await self.db.flush()
        return a

    async def update(self, a: Assignment, data: dict) -> Assignment:
        for k, v in data.items():
            if v is not None:
                setattr(a, k, v)
        await self.db.flush()
        return a

    async def delete(self, a: Assignment) -> None:
        await self.db.delete(a)
        await self.db.flush()

    async def publish(self, a: Assignment) -> Assignment:
        a.status = AssignmentStatus.PUBLISHED
        await self.db.flush()
        return a

    async def close(self, a: Assignment) -> Assignment:
        a.status = AssignmentStatus.CLOSED
        await self.db.flush()
        return a

    async def list_for_course(self, course_id: int) -> Sequence[Assignment]:
        stmt = (
            select(Assignment)
            .where(Assignment.course_id == course_id)
            .order_by(Assignment.created_at.desc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def list_published_for_student_courses(
        self, course_ids: Sequence[int]
    ) -> Sequence[Assignment]:
        if not course_ids:
            return []
        stmt = (
            select(Assignment)
            .where(
                Assignment.course_id.in_(list(course_ids)),
                Assignment.status == AssignmentStatus.PUBLISHED,
            )
            .order_by(
                case((Assignment.due_at.is_(None), 1), else_=0),
                Assignment.due_at.asc(),
                Assignment.created_at.desc(),
            )
        )
        return (await self.db.execute(stmt)).scalars().all()


    async def list_published_for_student_course(self, course_id: int) -> Sequence[Assignment]:
        stmt = (
            select(Assignment)
            .where(Assignment.course_id == course_id, Assignment.status == AssignmentStatus.PUBLISHED)
            .order_by(
                case((Assignment.due_at.is_(None), 1), else_=0),
                Assignment.due_at.asc(),
                Assignment.created_at.desc(),
            )
        )
        return (await self.db.execute(stmt)).scalars().all()

    # ---------- Submissions ----------
    async def get_submission(self, submission_id: int) -> Optional[AssignmentSubmission]:
        return (
            await self.db.execute(
                select(AssignmentSubmission).where(AssignmentSubmission.id == submission_id)
            )
        ).scalar_one_or_none()

    async def find_submission(
        self, assignment_id: int, student_id: int
    ) -> Optional[AssignmentSubmission]:
        return (
            await self.db.execute(
                select(AssignmentSubmission).where(
                    AssignmentSubmission.assignment_id == assignment_id,
                    AssignmentSubmission.student_id == student_id,
                )
            )
        ).scalar_one_or_none()

    async def create_submission(
        self, *, assignment_id: int, student_id: int, data: dict, status: SubmissionStatus
    ) -> AssignmentSubmission:
        from datetime import datetime, timezone
        s = AssignmentSubmission(
            assignment_id=assignment_id,
            student_id=student_id,
            status=status,
            submitted_at=datetime.now(timezone.utc),
            **data,
        )
        self.db.add(s)
        await self.db.flush()
        return s

    async def update_submission(self, sub: AssignmentSubmission, data: dict) -> AssignmentSubmission:
        for k, v in data.items():
            setattr(sub, k, v)
        await self.db.flush()
        return sub

    async def grade_submission(
        self, sub: AssignmentSubmission, *, score: float, feedback: Optional[str],
        graded_by: int, status: SubmissionStatus,
    ) -> AssignmentSubmission:
        from datetime import datetime, timezone
        sub.score = score
        sub.feedback = feedback
        sub.graded_by = graded_by
        sub.graded_at = datetime.now(timezone.utc)
        sub.status = status
        await self.db.flush()
        return sub

    async def list_submissions(
        self, assignment_id: int, *, page: int = 1, page_size: int = 50
    ) -> tuple[Sequence[AssignmentSubmission], int]:
        stmt = select(AssignmentSubmission).where(
            AssignmentSubmission.assignment_id == assignment_id
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.db.execute(count_stmt)).scalar_one())
        stmt = stmt.order_by(AssignmentSubmission.submitted_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def list_course_feedback(self, assignment_id: int, course_id: int, *, page: int = 1, page_size: int = 200):
        from app.models.course import Enrollment, EnrollmentStatus
        from app.models.user import User
        stmt = (
            select(Enrollment, User, AssignmentSubmission)
            .options(selectinload(User.profile))
            .join(User, User.id == Enrollment.student_id)
            .outerjoin(
                AssignmentSubmission,
                (AssignmentSubmission.assignment_id == assignment_id)
                & (AssignmentSubmission.student_id == Enrollment.student_id),
            )
            .where(Enrollment.course_id == course_id, Enrollment.status != EnrollmentStatus.DROPPED)
            .order_by(Enrollment.enrolled_at.asc(), User.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).all()
        count_stmt = select(func.count()).select_from(Enrollment).where(
            Enrollment.course_id == course_id, Enrollment.status != EnrollmentStatus.DROPPED
        )
        total = int((await self.db.execute(count_stmt)).scalar_one())
        return rows, total
