from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import CourseStatus, EnrollmentStatus, Course
from app.models.quiz import QuizAttempt
from app.models.user import User, UserRole
from app.models.progress import LearningActivity
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.progress_repository import LearningActivityRepository
from app.repositories.quiz_repository import QuizRepository


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.courses = CourseRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.activity = LearningActivityRepository(db)
        self.quizzes = QuizRepository(db)

    @staticmethod
    def _compute_streak(iso_dates_desc: list[str]) -> tuple[int, int, Optional[str]]:
        if not iso_dates_desc:
            return 0, 0, None

        dates = [date.fromisoformat(d) for d in iso_dates_desc]
        today = datetime.now(timezone.utc).date()

        current = 0
        if dates[0] in (today, today - timedelta(days=1)):
            expected = dates[0]
            for current_date in dates:
                if current_date != expected:
                    break
                current += 1
                expected -= timedelta(days=1)

        longest = 1
        run = 1
        for index in range(1, len(dates)):
            if dates[index] == dates[index - 1] - timedelta(days=1):
                run += 1
                longest = max(longest, run)
            else:
                run = 1

        return current, longest, str(dates[0])

    async def _activity_series_for_student(self, student_id: int, days: int = 7) -> list[dict]:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=days - 1)
        start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)

        stmt = (
            select(func.date(LearningActivity.created_at), func.count(LearningActivity.id))
            .where(
                LearningActivity.student_id == student_id,
                LearningActivity.created_at >= start_dt,
            )
            .group_by(func.date(LearningActivity.created_at))
            .order_by(func.date(LearningActivity.created_at))
        )
        rows = (await self.db.execute(stmt)).all()
        counts = {str(day): int(count) for day, count in rows}

        return [
            {
                "label": (start + timedelta(days=index)).strftime("%a"),
                "value": counts.get(str(start + timedelta(days=index)), 0),
                "date": str(start + timedelta(days=index)),
            }
            for index in range(days)
        ]

    async def _activity_series_for_teacher(self, teacher_id: int, days: int = 7) -> list[dict]:
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=days - 1)
        start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)

        stmt = (
            select(func.date(LearningActivity.created_at), func.count(LearningActivity.id))
            .join(Course, Course.id == LearningActivity.course_id)
            .where(
                Course.teacher_id == teacher_id,
                Course.status != CourseStatus.ARCHIVED,
                LearningActivity.created_at >= start_dt,
            )
            .group_by(func.date(LearningActivity.created_at))
            .order_by(func.date(LearningActivity.created_at))
        )
        rows = (await self.db.execute(stmt)).all()
        counts = {str(day): int(count) for day, count in rows}

        return [
            {
                "label": (start + timedelta(days=index)).strftime("%a"),
                "value": counts.get(str(start + timedelta(days=index)), 0),
                "date": str(start + timedelta(days=index)),
            }
            for index in range(days)
        ]

    async def student_overview(self, student: User) -> dict:
        rows, _ = await self.enrollments.list_for_student(student.id, page=1, page_size=200)
        course_summaries = []
        total_pct = 0.0
        active_count = 0

        for enrollment, course in rows:
            if enrollment.status == EnrollmentStatus.DROPPED:
                continue
            active_count += 1
            total_pct += float(enrollment.progress_percent or 0.0)
            last = await self.activity.last_activity_for_course(student.id, course.id)
            course_summaries.append(
                {
                    "course_id": course.id,
                    "title": course.title,
                    "progress_percent": round(float(enrollment.progress_percent or 0.0), 2),
                    "completed": enrollment.status == EnrollmentStatus.COMPLETED,
                    "last_activity_at": last,
                }
            )

        overall = round(total_pct / active_count, 2) if active_count else 0.0

        total_attempts, avg_pct, passed, failed = await self.quizzes.student_quiz_stats(student.id)

        stmt = (
            select(QuizAttempt.weak_topics)
            .where(
                QuizAttempt.student_id == student.id,
                QuizAttempt.completed_at.is_not(None),
                QuizAttempt.weak_topics.is_not(None),
            )
            .order_by(QuizAttempt.completed_at.desc())
            .limit(20)
        )
        rows2 = (await self.db.execute(stmt)).scalars().all()

        agg: dict[str, dict[str, int]] = {}
        for blob in rows2:
            items = (blob or {}).get("items") or []
            for item in items:
                topic = item.get("topic")
                if not topic:
                    continue
                state = agg.setdefault(topic, {"attempts": 0, "misses": 0})
                state["attempts"] += int(item.get("attempts", 0))
                state["misses"] += int(item.get("misses", 0))

        weak_topics = [
            {
                "topic": topic,
                "misses": state["misses"],
                "attempts": state["attempts"],
                "accuracy": round(
                    (state["attempts"] - state["misses"]) / state["attempts"], 3
                )
                if state["attempts"]
                else 0.0,
            }
            for topic, state in agg.items()
        ]
        weak_topics.sort(key=lambda item: (item["accuracy"], -item["attempts"]))

        roadmap = []
        ordered = sorted(
            [course for course in course_summaries if not course["completed"]],
            key=lambda item: item["progress_percent"],
        )
        for index, course in enumerate(ordered[:5], start=1):
            roadmap.append(
                {
                    "order": index,
                    "course_id": course["course_id"],
                    "title": course["title"],
                    "reason": "In progress" if course["progress_percent"] > 0 else "Not started",
                }
            )

        streak_dates = await self.activity.distinct_active_days(student.id, limit_days=400)
        current_streak, longest_streak, last_date = self._compute_streak(list(streak_dates))
        recent_count = await self.activity.recent_count(student.id, days=7)
        activity_last_7_days = await self._activity_series_for_student(student.id)

        return {
            "streak": {
                "current_streak_days": current_streak,
                "longest_streak_days": longest_streak,
                "last_activity_date": last_date,
            },
            "courses": course_summaries,
            "overall_progress_percent": overall,
            "quiz_performance": {
                "total_attempts": total_attempts,
                "avg_percentage": round(avg_pct, 2),
                "passed": passed,
                "failed": failed,
            },
            "weak_topics": weak_topics[:10],
            "roadmap": roadmap,
            "recent_activity_count_7d": recent_count,
            "activity_last_7_days": activity_last_7_days,
        }

    async def teacher_overview(self, teacher: User) -> dict:
        if teacher.role not in (UserRole.TEACHER, UserRole.ADMIN):
            from app.core.exceptions import AuthorizationError
            raise AuthorizationError("Only teachers have teacher analytics")

        courses, _ = await self.courses.list_teacher(teacher.id, page=1, page_size=200)
        stats = []
        total_students = 0

        for course in courses:
            enrollments, _ = await self.enrollments.list_students_for_course(
                course.id, page=1, page_size=1000
            )
            active = [e for e in enrollments if e.status != EnrollmentStatus.DROPPED]
            completed = [e for e in enrollments if e.status == EnrollmentStatus.COMPLETED]
            avg_progress = (
                sum(float(e.progress_percent or 0.0) for e in active) / len(active)
                if active
                else 0.0
            )
            avg_quiz = await self.quizzes.quiz_avg_for_course(course.id)
            total_students += len(active)

            stats.append(
                {
                    "course_id": course.id,
                    "title": course.title,
                    "status": course.status.value,
                    "enrolled_count": len(active),
                    "completed_count": len(completed),
                    "avg_progress_percent": round(avg_progress, 2),
                    "avg_quiz_percentage": round(avg_quiz, 2) if avg_quiz is not None else None,
                }
            )

        activity_last_7_days = await self._activity_series_for_teacher(teacher.id)

        return {
            "total_courses": len(courses),
            "total_students": total_students,
            "courses": stats,
            "activity_last_7_days": activity_last_7_days,
        }
