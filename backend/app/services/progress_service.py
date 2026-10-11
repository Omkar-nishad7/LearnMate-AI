from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.models.course import CourseStatus, Enrollment, EnrollmentStatus
from app.models.user import User, UserRole
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.lesson_repository import LessonRepository
from app.repositories.module_repository import ModuleRepository
from app.repositories.progress_repository import (
    LearningActivityRepository,
    ProgressRepository,
)
from app.repositories.video_repository import VideoRepository
from app.services.audit_service import AuditService


class ProgressService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.progress = ProgressRepository(db)
        self.activity = LearningActivityRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.courses = CourseRepository(db)
        self.modules = ModuleRepository(db)
        self.lessons = LessonRepository(db)
        self.videos = VideoRepository(db)
        self.audit = AuditService(db)

    # ---------------- Helpers ----------------
    async def _require_enrollment(self, student: User, course_id: int) -> Enrollment:
        if student.role != UserRole.STUDENT:
            raise AuthorizationError("Only students have progress")
        enr = await self.enrollments.get(student.id, course_id)
        if not enr or enr.status == EnrollmentStatus.DROPPED:
            raise AuthorizationError("You are not enrolled in this course")
        return enr

    async def _total_lessons(self, course_id: int) -> int:
        modules = await self.modules.list_by_course(course_id, with_lessons=True)
        return sum(len(m.lessons) for m in modules)

    async def _recompute_course_progress(self, student: User, course_id: int) -> Enrollment:
        total = await self._total_lessons(course_id)
        completed = await self.progress.count_completed_lessons(student.id, course_id)
        percent = (completed / total * 100.0) if total > 0 else 0.0

        enr = await self.enrollments.get(student.id, course_id)
        if not enr:
            raise NotFoundError("Enrollment not found")
        await self.enrollments.update_progress(enr, percent)
        return enr

    # ---------------- Lesson completion ----------------
    async def mark_lesson_complete(
        self,
        student: User,
        lesson_id: int,
        *,
        video_id: Optional[int] = None,
        last_position_seconds: Optional[int] = None,
        duration_seconds: Optional[int] = None,
    ):
        lesson = await self.lessons.get_by_id(lesson_id)
        if not lesson:
            raise NotFoundError("Lesson not found")
        module = await self.modules.get_by_id(lesson.module_id)
        if not module:
            raise NotFoundError("Module not found")
        course = await self.courses.get_by_id(module.course_id)
        if not course or course.status != CourseStatus.PUBLISHED:
            raise NotFoundError("Course not found")
        await self._require_enrollment(student, course.id)

        pct = 100.0
        if duration_seconds and last_position_seconds is not None:
            pct = min(100.0, last_position_seconds / duration_seconds * 100.0)

        await self.progress.upsert(
            student_id=student.id,
            course_id=course.id,
            lesson_id=lesson.id,
            video_id=video_id,
            is_completed=True,
            progress_percent=pct,
            last_position_seconds=last_position_seconds,
        )
        await self.activity.record(
            student_id=student.id,
            activity_type="lesson_completed",
            course_id=course.id,
            lesson_id=lesson.id,
            video_id=video_id,
            duration_seconds=duration_seconds,
            completed=True,
        )
        enr = await self._recompute_course_progress(student, course.id)
        await self.db.commit()
        return enr

    # ---------------- Video position ----------------
    async def update_video_progress(
        self,
        student: User,
        video_id: int,
        *,
        last_position_seconds: int,
        duration_seconds: int,
        completed: bool,
    ):
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise NotFoundError("Video not found")
        if video.lesson_id is None:
            raise ValidationError("Video is not attached to a lesson")

        lesson = await self.lessons.get_by_id(video.lesson_id)
        module = await self.modules.get_by_id(lesson.module_id)
        course = await self.courses.get_by_id(module.course_id)
        if not course:
            raise NotFoundError("Course not found")
        await self._require_enrollment(student, course.id)

        pct = min(100.0, last_position_seconds / max(duration_seconds, 1) * 100.0)
        if pct >= 90.0:
            completed = True
            pct = 100.0

        await self.progress.upsert(
            student_id=student.id,
            course_id=course.id,
            lesson_id=lesson.id,
            video_id=video.id,
            is_completed=completed,
            progress_percent=pct,
            last_position_seconds=last_position_seconds,
        )
        await self.activity.record(
            student_id=student.id,
            activity_type="video_progress",
            course_id=course.id,
            lesson_id=lesson.id,
            video_id=video.id,
            duration_seconds=last_position_seconds,
            completed=completed,
            metadata={"duration_seconds": duration_seconds, "percent": pct},
        )
        enr = await self._recompute_course_progress(student, course.id)
        await self.db.commit()
        return {
            "video_id": video.id,
            "course_id": course.id,
            "lesson_id": lesson.id,
            "last_position_seconds": last_position_seconds,
            "progress_percent": pct,
            "is_completed": completed,
        }

    # ---------------- Query ----------------
    async def course_progress(self, student: User, course_id: int):
        await self._require_enrollment(student, course_id)
        total = await self._total_lessons(course_id)
        completed = await self.progress.count_completed_lessons(student.id, course_id)
        percent = (completed / total * 100.0) if total > 0 else 0.0
        last = await self.activity.last_activity_for_course(student.id, course_id)
        return {
            "course_id": course_id,
            "total_lessons": total,
            "completed_lessons": completed,
            "progress_percent": round(percent, 2),
            "is_completed": total > 0 and completed >= total,
            "last_activity_at": last,
        }

    async def lesson_progress(self, student: User, lesson_id: int):
        row = await self.progress.get_for_lesson(student.id, lesson_id)
        return row