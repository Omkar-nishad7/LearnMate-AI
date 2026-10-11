from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.quiz import (
    Quiz,
    QuizAttempt,
    QuizAnswer,
    QuizQuestion,
    QuizStatus,
)


class QuizRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------- Quiz CRUD ----------
    async def get(self, quiz_id: int, with_questions: bool = False) -> Optional[Quiz]:
        stmt = select(Quiz).where(Quiz.id == quiz_id)
        if with_questions:
            stmt = stmt.options(selectinload(Quiz.questions))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(self, *, creator_id: int, data: dict) -> Quiz:
        quiz = Quiz(creator_id=creator_id, status=QuizStatus.DRAFT, **data)
        self.db.add(quiz)
        await self.db.flush()
        return quiz

    async def update(self, quiz: Quiz, data: dict) -> Quiz:
        for k, v in data.items():
            if v is not None:
                setattr(quiz, k, v)
        await self.db.flush()
        return quiz

    async def add_question(self, quiz_id: int, data: dict) -> QuizQuestion:
        q = QuizQuestion(quiz_id=quiz_id, **data)
        self.db.add(q)
        await self.db.flush()
        return q

    async def delete_question(self, question: QuizQuestion) -> None:
        await self.db.delete(question)
        await self.db.flush()

    async def get_question(self, question_id: int) -> Optional[QuizQuestion]:
        return (
            await self.db.execute(
                select(QuizQuestion).where(QuizQuestion.id == question_id)
            )
        ).scalar_one_or_none()

    async def list_questions(self, quiz_id: int) -> Sequence[QuizQuestion]:
        stmt = (
            select(QuizQuestion)
            .where(QuizQuestion.quiz_id == quiz_id)
            .order_by(QuizQuestion.order_index.asc(), QuizQuestion.id.asc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def publish(self, quiz: Quiz) -> Quiz:
        quiz.status = QuizStatus.PUBLISHED
        await self.db.flush()
        return quiz

    async def recompute_total_points(self, quiz: Quiz) -> Quiz:
        stmt = select(func.coalesce(func.sum(QuizQuestion.points), 0)).where(
            QuizQuestion.quiz_id == quiz.id
        )
        quiz.total_points = int((await self.db.execute(stmt)).scalar_one())
        await self.db.flush()
        return quiz


    async def list_published_for_student(self, student_id: int) -> Sequence[Quiz]:
        from app.models.course import Enrollment, EnrollmentStatus

        # Assigned course quizzes are visible through an active/completed enrollment.
        # Student-generated AI quizzes from standalone/imported videos have no
        # course_id, so they must also be visible to their creator.
        enrollment_clause = and_(
            Quiz.course_id.is_not(None),
            Enrollment.student_id == student_id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
        )
        own_standalone_clause = and_(
            Quiz.course_id.is_(None),
            Quiz.creator_id == student_id,
            Quiz.is_ai_generated.is_(True),
        )

        stmt = (
            select(Quiz)
            .outerjoin(Enrollment, Enrollment.course_id == Quiz.course_id)
            .where(
                Quiz.status == QuizStatus.PUBLISHED,
                or_(enrollment_clause, own_standalone_clause),
            )
            .distinct()
            .order_by(Quiz.created_at.desc())
        )
        return (await self.db.execute(stmt)).scalars().all()

    async def list_for_creator(self, creator_id: int) -> Sequence[Quiz]:
        stmt = select(Quiz).where(Quiz.creator_id == creator_id).order_by(Quiz.created_at.desc())
        return (await self.db.execute(stmt)).scalars().all()

    async def delete(self, quiz: Quiz) -> None:
        await self.db.delete(quiz)
        await self.db.flush()

    # ---------- Attempts ----------
    async def create_attempt(self, quiz_id: int, student_id: int) -> QuizAttempt:
        a = QuizAttempt(
            quiz_id=quiz_id,
            student_id=student_id,
            started_at=datetime.now(timezone.utc),
            score=0.0,
            max_score=0.0,
            percentage=0.0,
            passed=False,
        )
        self.db.add(a)
        await self.db.flush()
        return a

    async def get_attempt(self, attempt_id: int, with_answers: bool = False) -> Optional[QuizAttempt]:
        stmt = select(QuizAttempt).where(QuizAttempt.id == attempt_id)
        if with_answers:
            stmt = stmt.options(selectinload(QuizAttempt.answers))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def count_attempts(self, quiz_id: int, student_id: int) -> int:
        stmt = select(func.count()).select_from(
            select(QuizAttempt)
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.student_id == student_id)
            .subquery()
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def get_latest_completed_attempt(
        self, quiz_id: int, student_id: int
    ) -> Optional[QuizAttempt]:
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.student_id == student_id,
                QuizAttempt.completed_at.is_not(None),
            )
            .options(selectinload(QuizAttempt.answers))
            .order_by(QuizAttempt.completed_at.desc(), QuizAttempt.id.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def add_answer(self, *, attempt_id: int, question_id: int, given_answer: Optional[str],
                         is_correct: bool, points_awarded: float) -> QuizAnswer:
        ans = QuizAnswer(
            attempt_id=attempt_id, question_id=question_id,
            given_answer=given_answer, is_correct=is_correct,
            points_awarded=points_awarded,
        )
        self.db.add(ans)
        await self.db.flush()
        return ans

    async def finalize_attempt(
        self,
        attempt: QuizAttempt,
        *,
        score: float,
        max_score: float,
        percentage: float,
        passed: bool,
        time_taken_seconds: Optional[int],
        weak_topics: Optional[list],
    ) -> QuizAttempt:
        attempt.score = score
        attempt.max_score = max_score
        attempt.percentage = percentage
        attempt.passed = passed
        attempt.time_taken_seconds = time_taken_seconds
        attempt.weak_topics = {"items": weak_topics or []}
        attempt.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return attempt

    # ---------- Analytics helpers ----------
    async def student_quiz_stats(self, student_id: int) -> tuple[int, float, int, int]:
        stmt = select(
            func.count(QuizAttempt.id),
            func.coalesce(func.avg(QuizAttempt.percentage), 0.0),
            func.coalesce(func.sum(case((QuizAttempt.passed.is_(True), 1), else_=0)), 0),
            func.coalesce(func.sum(case((QuizAttempt.passed.is_(False), 1), else_=0)), 0),
        ).where(
            QuizAttempt.student_id == student_id,
            QuizAttempt.completed_at.is_not(None),
        )
        row = (await self.db.execute(stmt)).one()
        return int(row[0]), float(row[1]), int(row[2]), int(row[3])

    async def quiz_avg_for_course(self, course_id: int) -> Optional[float]:
        stmt = (
            select(func.coalesce(func.avg(QuizAttempt.percentage), None))
            .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
            .where(Quiz.course_id == course_id, QuizAttempt.completed_at.is_not(None))
        )
        val = (await self.db.execute(stmt)).scalar_one()
        return float(val) if val is not None else None