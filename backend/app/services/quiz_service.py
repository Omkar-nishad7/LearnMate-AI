from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.models.course import CourseStatus
from app.models.course import EnrollmentStatus
from app.models.quiz import QuestionType, Quiz, QuizAttempt, QuizStatus
from app.models.user import User, UserRole
from app.repositories.course_repository import CourseRepository
from app.repositories.module_repository import ModuleRepository
from app.repositories.lesson_repository import LessonRepository
from app.repositories.progress_repository import LearningActivityRepository
from app.repositories.quiz_repository import QuizRepository
from app.services.audit_service import AuditService
from app.repositories.enrollment_repository import EnrollmentRepository
from app.services.notification_service import NotificationService


class QuizService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.quizzes = QuizRepository(db)
        self.courses = CourseRepository(db)
        self.modules = ModuleRepository(db)
        self.lessons = LessonRepository(db)
        self.activity = LearningActivityRepository(db)
        self.audit = AuditService(db)
        self.enrollments = EnrollmentRepository(db)
        self.notifications = NotificationService(db)

    # ---------------- Authoring ----------------
    async def _assert_quiz_owner(self, actor: User, quiz: Quiz) -> None:
        if actor.role == UserRole.ADMIN:
            return
        if quiz.creator_id != actor.id:
            raise AuthorizationError("You do not own this quiz")

    async def _assert_course_owned(self, actor: User, course_id: Optional[int]) -> None:
        if course_id is None:
            return
        course = await self.courses.get_by_id(course_id)
        if not course:
            raise NotFoundError("Course not found")
        if actor.role != UserRole.ADMIN and course.teacher_id != actor.id:
            raise AuthorizationError("You do not own this course")

    async def create_quiz(self, actor: User, data: dict) -> Quiz:
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can create quizzes")
        await self._assert_course_owned(actor, data.get("course_id"))
        quiz = await self.quizzes.create(creator_id=actor.id, data=data)
        await self.audit.log(
            action="quiz.created", user_id=actor.id, entity_type="quiz", entity_id=quiz.id
        )
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def update_quiz(self, actor: User, quiz_id: int, data: dict) -> Quiz:
        quiz = await self.quizzes.get(quiz_id)
        if not quiz:
            raise NotFoundError("Quiz not found")
        await self._assert_quiz_owner(actor, quiz)
        await self.quizzes.update(quiz, data)
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def add_question(self, actor: User, quiz_id: int, data: dict):
        quiz = await self.quizzes.get(quiz_id)
        if not quiz:
            raise NotFoundError("Quiz not found")
        await self._assert_quiz_owner(actor, quiz)
        if data.get("question_type") == "MCQ":
            opts = data.get("options") or {}
            if len(opts) < 2:
                raise ValidationError("MCQ requires at least 2 options")
            if data["correct_answer"] not in opts:
                raise ValidationError("correct_answer must be one of the option keys")
        q = await self.quizzes.add_question(quiz.id, data)
        await self.quizzes.recompute_total_points(quiz)
        await self.db.commit()
        await self.db.refresh(q)
        return q

    async def publish(self, actor: User, quiz_id: int) -> Quiz:
        quiz = await self.quizzes.get(quiz_id, with_questions=True)
        if not quiz:
            raise NotFoundError("Quiz not found")
        await self._assert_quiz_owner(actor, quiz)
        if not quiz.questions:
            raise ValidationError("Cannot publish a quiz with no questions")
        await self.quizzes.publish(quiz)
        await self.audit.log(
            action="quiz.published", user_id=actor.id, entity_type="quiz", entity_id=quiz.id
        )
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def get_author_detail(self, actor: User, quiz_id: int) -> Quiz:
        quiz = await self.quizzes.get(quiz_id, with_questions=True)
        if not quiz:
            raise NotFoundError("Quiz not found")
        await self._assert_quiz_owner(actor, quiz)
        return quiz

    # ---------------- Student access ----------------

    async def list_for_student(self, actor: User):
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can list student quizzes")

        quizzes = await self.quizzes.list_published_for_student(actor.id)
        items = []
        for quiz in quizzes:
            attempt_count = await self.quizzes.count_attempts(quiz.id, actor.id)
            latest = await self.quizzes.get_latest_completed_attempt(quiz.id, actor.id)
            items.append((quiz, attempt_count, latest))
        return items

    async def delete_student_quiz(self, actor: User, quiz_id: int) -> None:
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can delete student quizzes")

        quiz = await self.quizzes.get(quiz_id)
        if not quiz:
            raise NotFoundError("Quiz not found")

        # Students may delete only their own standalone AI-generated quizzes.
        # Teacher-assigned/course quizzes remain protected.
        if (
            quiz.creator_id != actor.id
            or not quiz.is_ai_generated
            or quiz.course_id is not None
        ):
            raise AuthorizationError("You can only delete your own AI-generated quizzes")

        await self.quizzes.delete(quiz)
        await self.audit.log(
            action="quiz.deleted",
            user_id=actor.id,
            entity_type="quiz",
            entity_id=quiz.id,
        )
        await self.db.commit()

    async def list_for_teacher(self, actor: User):
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can list teaching quizzes")
        return await self.quizzes.list_for_creator(actor.id)

    async def get_student_detail(self, actor: User, quiz_id: int) -> Quiz:
        quiz = await self.quizzes.get(quiz_id, with_questions=True)
        if not quiz or quiz.status != QuizStatus.PUBLISHED:
            raise NotFoundError("Quiz not found")
        if quiz.course_id:
            enrollment = await self.enrollments.get(actor.id, quiz.course_id)
            if not enrollment or enrollment.status == EnrollmentStatus.DROPPED:
                raise AuthorizationError("You are not enrolled in this course")
        return quiz

    async def start_attempt(self, actor: User, quiz_id: int) -> QuizAttempt:
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can take quizzes")
        quiz = await self.get_student_detail(actor, quiz_id)
        attempts = await self.quizzes.count_attempts(quiz.id, actor.id)
        if attempts >= quiz.max_attempts:
            raise ConflictError("Maximum attempts reached")
        attempt = await self.quizzes.create_attempt(quiz.id, actor.id)
        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt

    def _grade_answer(self, question, given: Optional[str]) -> tuple[bool, float]:
        if given is None:
            return False, 0.0
        given_norm = given.strip()
        correct_norm = (question.correct_answer or "").strip()

        if question.question_type in (QuestionType.MCQ, QuestionType.TRUE_FALSE):
            return (given_norm.upper() == correct_norm.upper(), float(question.points) if given_norm.upper() == correct_norm.upper() else 0.0)

        # SHORT_ANSWER: case-insensitive, whitespace-collapsed exact match
        g = " ".join(given_norm.lower().split())
        c = " ".join(correct_norm.lower().split())
        ok = g == c and len(g) > 0
        return ok, float(question.points) if ok else 0.0

    async def submit_attempt(
        self,
        actor: User,
        attempt_id: int,
        *,
        answers: list[dict],
        time_taken_seconds: Optional[int] = None,
    ) -> QuizAttempt:
        attempt = await self.quizzes.get_attempt(attempt_id, with_answers=True)
        if not attempt:
            raise NotFoundError("Attempt not found")
        if attempt.student_id != actor.id:
            raise AuthorizationError("You do not own this attempt")
        if attempt.completed_at is not None:
            raise ConflictError("Attempt already submitted")

        quiz = await self.quizzes.get(attempt.quiz_id, with_questions=True)
        if not quiz:
            raise NotFoundError("Quiz not found")

        questions = {q.id: q for q in quiz.questions}
        answered_ids = set()
        score = 0.0
        max_score = 0.0
        topic_stats: dict[str, dict[str, int]] = {}

        for ans in answers:
            qid = ans["question_id"]
            if qid not in questions:
                raise ValidationError(f"Question {qid} not in this quiz")
            if qid in answered_ids:
                raise ValidationError(f"Duplicate answer for question {qid}")
            answered_ids.add(qid)

            q = questions[qid]
            max_score += q.points
            is_correct, awarded = self._grade_answer(q, ans.get("given_answer"))
            score += awarded

            await self.quizzes.add_answer(
                attempt_id=attempt.id,
                question_id=q.id,
                given_answer=ans.get("given_answer"),
                is_correct=is_correct,
                points_awarded=awarded,
            )

            if q.topic:
                st = topic_stats.setdefault(q.topic, {"attempts": 0, "misses": 0})
                st["attempts"] += 1
                if not is_correct:
                    st["misses"] += 1

        # Unanswered questions count toward max_score but not toward answers
        for qid, q in questions.items():
            if qid not in answered_ids:
                max_score += q.points

        percentage = (score / max_score * 100.0) if max_score > 0 else 0.0
        passed = percentage >= quiz.pass_percentage

        weak_topics = [
            {
                "topic": t,
                "misses": s["misses"],
                "attempts": s["attempts"],
                "accuracy": round((s["attempts"] - s["misses"]) / s["attempts"], 3),
            }
            for t, s in topic_stats.items()
        ]
        weak_topics.sort(key=lambda x: (x["accuracy"], -x["attempts"]))

        await self.quizzes.finalize_attempt(
            attempt,
            score=score, max_score=max_score, percentage=percentage,
            passed=passed, time_taken_seconds=time_taken_seconds,
            weak_topics=weak_topics,
        )

        # Learning activity
        await self.activity.record(
            student_id=actor.id,
            activity_type="quiz_attempt",
            course_id=quiz.course_id,
            completed=True,
            score=percentage,
            metadata={"quiz_id": quiz.id, "attempt_id": attempt.id, "passed": passed},
        )

        # Notification
        await self.notifications.notify(
            user_id=actor.id,
            type="quiz_result",
            title=("Quiz passed" if passed else "Quiz completed"),
            body=f"{quiz.title}: {percentage:.1f}%",
            link_url=f"/student/quiz-result?attempt_id={attempt.id}",
            metadata={"quiz_id": quiz.id, "percentage": percentage},
        )

        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt

    async def get_latest_student_attempt(self, actor: User, quiz_id: int) -> Optional[QuizAttempt]:
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can view student attempts")
        await self.get_student_detail(actor, quiz_id)
        return await self.quizzes.get_latest_completed_attempt(quiz_id, actor.id)

    async def get_attempt_result(self, actor: User, attempt_id: int) -> tuple[QuizAttempt, Quiz]:
        attempt = await self.quizzes.get_attempt(attempt_id, with_answers=True)
        if not attempt:
            raise NotFoundError("Attempt not found")
        quiz = await self.quizzes.get(attempt.quiz_id, with_questions=True)
        if not quiz:
            raise NotFoundError("Quiz not found")

        # student self-access; owner teacher access
        if not (actor.id == attempt.student_id or actor.id == quiz.creator_id or actor.role == UserRole.ADMIN):
            raise AuthorizationError("You do not have access to this attempt")
        return attempt, quiz