from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.logging import get_logger
from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.models.course import (
    Course,
    CourseLesson,
    CourseModule,
    CourseStatus,
    Enrollment,
    EnrollmentStatus,
)
from app.models.user import User, UserRole
from app.models.video import Video
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.lesson_repository import LessonRepository
from app.repositories.module_repository import ModuleRepository
from app.services.audit_service import AuditService

logger = get_logger("course")


class CourseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.courses = CourseRepository(db)
        self.modules = ModuleRepository(db)
        self.lessons = LessonRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.audit = AuditService(db)

    # ---------------- Authorization helpers ----------------
    def _assert_owner(self, actor: User, course: Course) -> None:
        if actor.role == UserRole.ADMIN:
            return
        if course.teacher_id != actor.id:
            raise AuthorizationError("You do not own this course")

    async def _get_owned_course(self, actor: User, course_id: int) -> Course:
        course = await self.courses.get_by_id(course_id)
        if not course:
            raise NotFoundError("Course not found")
        self._assert_owner(actor, course)
        return course

    async def _get_course_response(self, course_id: int) -> Course:
        """Reload a course with its modules before returning a CourseDetail.

        CourseDetail exposes the modules relationship. With AsyncSession, returning
        a just-committed ORM object with an unloaded relationship can make Pydantic
        trigger an implicit lazy load during response serialization, which raises
        MissingGreenlet and becomes a 500 response.
        """
        course = await self.courses.get_by_id(course_id, with_modules=True)
        if not course:
            raise NotFoundError("Course not found")
        return course

    async def _get_module_owned(self, actor: User, module_id: int) -> CourseModule:
        module = await self.modules.get_by_id(module_id)
        if not module:
            raise NotFoundError("Module not found")
        course = await self.courses.get_by_id(module.course_id)
        if not course:
            raise NotFoundError("Course not found")
        self._assert_owner(actor, course)
        return module

    async def _get_lesson_owned(self, actor: User, lesson_id: int) -> CourseLesson:
        lesson = await self.lessons.get_by_id(lesson_id)
        if not lesson:
            raise NotFoundError("Lesson not found")
        module = await self.modules.get_by_id(lesson.module_id)
        if not module:
            raise NotFoundError("Module not found")
        course = await self.courses.get_by_id(module.course_id)
        if not course:
            raise NotFoundError("Course not found")
        self._assert_owner(actor, course)
        return lesson


    # ---------------- Course CRUD ----------------
    async def create_course(self, actor: User, data: dict) -> Course:
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can create courses")
        course = await self.courses.create(teacher_id=actor.id, data=data)
        await self.audit.log(
            action="course.created",
            user_id=actor.id,
            entity_type="course",
            entity_id=course.id,
        )
        await self.db.commit()
        return await self._get_course_response(course.id)

    async def update_course(self, actor: User, course_id: int, data: dict) -> Course:
        course = await self._get_owned_course(actor, course_id)
        if course.status == CourseStatus.ARCHIVED:
            raise ValidationError("Cannot edit an archived course")
        await self.courses.update(course, data)
        await self.audit.log(
            action="course.updated",
            user_id=actor.id,
            entity_type="course",
            entity_id=course.id,
        )
        await self.db.commit()
        return await self._get_course_response(course.id)

    async def publish_course(self, actor: User, course_id: int) -> Course:
        course = await self._get_owned_course(actor, course_id)
        if course.status == CourseStatus.PUBLISHED:
            return course
        if course.status == CourseStatus.ARCHIVED:
            raise ValidationError("Cannot publish an archived course")
        # must have at least one module with at least one lesson
        modules = await self.modules.list_by_course(course.id, with_lessons=True)
        if not modules or not any(m.lessons for m in modules):
            raise ValidationError("Cannot publish: course must have at least one lesson")
        from datetime import datetime, timezone
        course.status = CourseStatus.PUBLISHED
        course.published_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.audit.log(
            action="course.published", user_id=actor.id, entity_type="course", entity_id=course.id
        )
        await self.db.commit()
        return await self._get_course_response(course.id)

    async def archive_course(self, actor: User, course_id: int) -> Course:
        course = await self._get_owned_course(actor, course_id)
        if course.status == CourseStatus.ARCHIVED:
            return course
        from datetime import datetime, timezone
        course.status = CourseStatus.ARCHIVED
        course.archived_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.audit.log(
            action="course.archived", user_id=actor.id, entity_type="course", entity_id=course.id
        )
        await self.db.commit()
        return await self._get_course_response(course.id)

    async def unarchive_course(self, actor: User, course_id: int) -> Course:
        course = await self._get_owned_course(actor, course_id)
        if course.status != CourseStatus.ARCHIVED:
            return course
        course.status = CourseStatus.DRAFT
        course.archived_at = None
        await self.db.flush()
        await self.audit.log(
            action="course.unarchived", user_id=actor.id,
            entity_type="course", entity_id=course.id
        )
        await self.db.commit()
        return await self._get_course_response(course.id)

    async def delete_course(self, actor: User, course_id: int) -> None:
        course = await self._get_owned_course(actor, course_id)
        await self.courses.delete(course)
        await self.audit.log(
            action="course.deleted", user_id=actor.id, entity_type="course", entity_id=course_id
        )
        await self.db.commit()

    async def get_course_for_viewer(
        self, actor: Optional[User], course_id: int, with_lessons: bool = True
    ) -> Course:
        course = (
            await self.courses.get_with_modules_and_lessons(course_id)
            if with_lessons
            else await self.courses.get_by_id(course_id, with_modules=True)
        )
        if not course:
            raise NotFoundError("Course not found")

        # teacher/owner/admin can view any of their own courses
        if actor and (
            actor.role == UserRole.ADMIN
            or (actor.role == UserRole.TEACHER and course.teacher_id == actor.id)
        ):
            return course

        # published course: students may view
        if course.status == CourseStatus.PUBLISHED:
            return course

        # unpublished + not owner -> 404 (do not leak existence)
        raise NotFoundError("Course not found")

    async def list_course_videos(self, actor: User, course_id: int) -> list[Video]:
        course = await self.get_course_for_viewer(
            actor,
            course_id,
            with_lessons=False,
        )

        if actor.role == UserRole.STUDENT:
            enrollment = await self.enrollments.get(actor.id, course.id)

            if not enrollment or enrollment.status == EnrollmentStatus.DROPPED:
                raise AuthorizationError(
                    "You must be enrolled to access course videos"
                )

        stmt = (
            select(Video)
            .join(CourseLesson, Video.lesson_id == CourseLesson.id)
            .join(CourseModule, CourseLesson.module_id == CourseModule.id)
            .where(
                CourseModule.course_id == course_id,
                # A teacher's course studio can only manage videos owned by
                # that course's teacher. Personal student imports are never
                # surfaced here.
                Video.owner_id == course.teacher_id,
            )
            .order_by(
                CourseModule.order_index.asc(),
                CourseLesson.order_index.asc(),
                Video.created_at.asc(),
            )
        )

        result = await self.db.execute(stmt)

        return list(result.scalars().all())


    # ---------------- Module CRUD ----------------
    async def create_module(self, actor: User, course_id: int, data: dict) -> CourseModule:
        course = await self._get_owned_course(actor, course_id)
        order_index = data.get("order_index")
        if order_index is None:
            order_index = await self.modules.next_order_index(course.id)
        if await self.modules.order_index_taken(course.id, order_index):
            raise ConflictError(f"order_index {order_index} already used in this course")
        data["order_index"] = order_index
        module = await self.modules.create(course.id, data)
        await self.audit.log(
            action="module.created",
            user_id=actor.id,
            entity_type="module",
            entity_id=module.id,
        )
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def update_module(self, actor: User, module_id: int, data: dict) -> CourseModule:
        module = await self._get_module_owned(actor, module_id)
        new_order = data.get("order_index")
        if new_order is not None and new_order != module.order_index:
            if await self.modules.order_index_taken(module.course_id, new_order, exclude_id=module.id):
                raise ConflictError(f"order_index {new_order} already used")
        await self.modules.update(module, data)
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def delete_module(self, actor: User, module_id: int) -> None:
        module = await self._get_module_owned(actor, module_id)
        await self.modules.delete(module)
        await self.audit.log(
            action="module.deleted",
            user_id=actor.id,
            entity_type="module",
            entity_id=module_id,
        )
        await self.db.commit()

    # ---------------- Lesson CRUD ----------------
    async def create_lesson(self, actor: User, module_id: int, data: dict) -> CourseLesson:
        module = await self._get_module_owned(actor, module_id)
        order_index = data.get("order_index")
        if order_index is None:
            order_index = await self.lessons.next_order_index(module.id)
        if await self.lessons.order_index_taken(module.id, order_index):
            raise ConflictError(f"order_index {order_index} already used in this module")
        data["order_index"] = order_index
        lesson = await self.lessons.create(module.id, data)
        await self.audit.log(
            action="lesson.created",
            user_id=actor.id,
            entity_type="lesson",
            entity_id=lesson.id,
        )
        await self.db.commit()
        await self.db.refresh(lesson)
        return lesson

    async def update_lesson(self, actor: User, lesson_id: int, data: dict) -> CourseLesson:
        lesson = await self._get_lesson_owned(actor, lesson_id)
        new_order = data.get("order_index")
        if new_order is not None and new_order != lesson.order_index:
            if await self.lessons.order_index_taken(lesson.module_id, new_order, exclude_id=lesson.id):
                raise ConflictError(f"order_index {new_order} already used")
        await self.lessons.update(lesson, data)
        await self.db.commit()
        await self.db.refresh(lesson)
        return lesson

    async def delete_lesson(self, actor: User, lesson_id: int) -> None:
        lesson = await self._get_lesson_owned(actor, lesson_id)
        await self.lessons.delete(lesson)
        await self.audit.log(
            action="lesson.deleted",
            user_id=actor.id,
            entity_type="lesson",
            entity_id=lesson_id,
        )
        await self.db.commit()

    # ---------------- Enrollment ----------------
    async def enroll(self, student: User, course_id: int) -> Enrollment:
        if student.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can enroll")

        course = await self.courses.get_by_id(course_id)
        if not course or course.status != CourseStatus.PUBLISHED:
            raise NotFoundError("Course not found or not open for enrollment")

        existing = await self.enrollments.get(student.id, course_id)
        if existing:
            if existing.status == EnrollmentStatus.ACTIVE:
                raise ConflictError("Already enrolled")
            # re-activate dropped enrollment
            await self.enrollments.update_status(existing, EnrollmentStatus.ACTIVE)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        enr = await self.enrollments.create(student.id, course_id)
        await self.audit.log(
            action="course.enrolled",
            user_id=student.id,
            entity_type="course",
            entity_id=course_id,
        )
        await self.db.commit()
        await self.db.refresh(enr)
        return enr

    async def unenroll(self, student: User, course_id: int) -> Enrollment:
        enr = await self.enrollments.get(student.id, course_id)
        if not enr:
            raise NotFoundError("Enrollment not found")
        await self.enrollments.update_status(enr, EnrollmentStatus.DROPPED)
        await self.audit.log(
            action="course.unenrolled",
            user_id=student.id,
            entity_type="course",
            entity_id=course_id,
        )
        await self.db.commit()
        await self.db.refresh(enr)
        return enr

    async def is_enrolled(self, student_id: int, course_id: int) -> bool:
        enr = await self.enrollments.get(student_id, course_id)
        return bool(enr and enr.status != EnrollmentStatus.DROPPED)

    async def get_lesson_for_student(self, student: User, lesson_id: int) -> CourseLesson:
        lesson = await self.lessons.get_by_id(lesson_id)
        if not lesson:
            raise NotFoundError("Lesson not found")
        module = await self.modules.get_by_id(lesson.module_id)
        if not module:
            raise NotFoundError("Module not found")
        course = await self.courses.get_by_id(module.course_id)
        if not course:
            raise NotFoundError("Course not found")

        # preview lessons are open
        if lesson.is_preview and course.status == CourseStatus.PUBLISHED:
            return lesson

        # enrolled students can access any lesson of the course
        if course.status == CourseStatus.PUBLISHED and await self.is_enrolled(student.id, course.id):
            return lesson

        raise AuthorizationError("You must be enrolled to view this lesson")
