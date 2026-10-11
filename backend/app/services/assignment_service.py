from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.models.assignment import (
    Assignment,
    AssignmentStatus,
    SubmissionStatus,
)
from app.models.course import Course, Enrollment, EnrollmentStatus
from app.models.user import User, UserRole
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.progress_repository import LearningActivityRepository
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService


class AssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.assignments = AssignmentRepository(db)
        self.courses = CourseRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.activity = LearningActivityRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    # ---------------- Teacher ----------------
    async def _assert_course_owned(self, actor: User, course_id: int) -> Course:
        course = await self.courses.get_by_id(course_id)
        if not course:
            raise NotFoundError("Course not found")
        if actor.role != UserRole.ADMIN and course.teacher_id != actor.id:
            raise AuthorizationError("You do not own this course")
        return course

    async def _assert_assignment_owned(self, actor: User, assignment_id: int) -> Assignment:
        a = await self.assignments.get(assignment_id)
        if not a:
            raise NotFoundError("Assignment not found")
        await self._assert_course_owned(actor, a.course_id)
        return a

    @staticmethod
    def _normalize_questions(raw_questions) -> list[dict]:
        questions = raw_questions or []
        normalized = []
        for q in questions:
            item = dict(q)
            options = [str(x).strip() for x in item.get("options", [])]
            if len(options) < 2:
                raise ValidationError("Each MCQ must have at least 2 options")
            correct = int(item.get("correct_option", -1))
            if correct < 0 or correct >= len(options):
                raise ValidationError("Each MCQ must have a valid correct option")
            question = str(item.get("question", "")).strip()
            if not question:
                raise ValidationError("Each MCQ must have a question")
            normalized.append({"id": str(item.get("id") or f"q-{len(normalized)+1}"), "question": question, "options": options, "correct_option": correct})
        if not normalized:
            raise ValidationError("Add at least one MCQ")
        return normalized

    @staticmethod
    def student_questions(a: Assignment) -> list[dict]:
        return [{"id": q.get("id"), "question": q.get("question", ""), "options": q.get("options", [])} for q in (a.questions or [])]

    async def create_assignment(self, actor: User, data: dict) -> Assignment:
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can create assignments")
        await self._assert_course_owned(actor, data["course_id"])
        data["questions"] = self._normalize_questions(data.get("questions"))
        a = await self.assignments.create(actor.id, data)
        await self.audit.log(
            action="assignment.created",
            user_id=actor.id, entity_type="assignment", entity_id=a.id,
        )
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def get_for_teacher(self, actor: User, assignment_id: int) -> Assignment:
        return await self._assert_assignment_owned(actor, assignment_id)

    async def delete_assignment(self, actor: User, assignment_id: int) -> None:
        a = await self._assert_assignment_owned(actor, assignment_id)
        await self.assignments.delete(a)
        await self.audit.log(
            action="assignment.deleted", user_id=actor.id,
            entity_type="assignment", entity_id=assignment_id,
        )
        await self.db.commit()

    async def update_assignment(self, actor: User, assignment_id: int, data: dict) -> Assignment:
        a = await self._assert_assignment_owned(actor, assignment_id)
        if "questions" in data and data["questions"] is not None:
            data["questions"] = self._normalize_questions(data["questions"])
        await self.assignments.update(a, data)
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def publish_assignment(self, actor: User, assignment_id: int) -> Assignment:
        a = await self._assert_assignment_owned(actor, assignment_id)
        if a.status == AssignmentStatus.CLOSED:
            raise ValidationError("Cannot publish a closed assignment")
        await self.assignments.publish(a)
        # notify enrolled students
        enrs, _ = await self.enrollments.list_students_for_course(a.course_id, page=1, page_size=500)
        for enr in enrs:
            if enr.status == EnrollmentStatus.DROPPED:
                continue
            await self.notifications.notify(
                user_id=enr.student_id,
                type="assignment_created",
                title="New assignment",
                body=a.title,
                link_url=f"/student/assignments/{a.id}",
                metadata={"assignment_id": a.id, "course_id": a.course_id},
            )
        await self.audit.log(
            action="assignment.published",
            user_id=actor.id, entity_type="assignment", entity_id=a.id,
        )
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def close_assignment(self, actor: User, assignment_id: int) -> Assignment:
        a = await self._assert_assignment_owned(actor, assignment_id)
        await self.assignments.close(a)
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def list_for_course(self, actor: User, course_id: int) -> Sequence[Assignment]:
        await self._assert_course_owned(actor, course_id)
        return await self.assignments.list_for_course(course_id)

    async def list_for_student_course(self, actor: User, course_id: int) -> Sequence[Assignment]:
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students have assignment lists")
        enr = await self.enrollments.get(actor.id, course_id)
        if not enr or enr.status == EnrollmentStatus.DROPPED:
            raise AuthorizationError("You are not enrolled in this course")
        return await self.assignments.list_published_for_student_course(course_id)

    async def list_submissions(self, actor: User, assignment_id: int, *, page: int = 1, page_size: int = 50):
        a = await self._assert_assignment_owned(actor, assignment_id)
        return await self.assignments.list_submissions(a.id, page=page, page_size=page_size)

    async def list_feedback(self, actor: User, assignment_id: int, *, page: int = 1, page_size: int = 200):
        a = await self._assert_assignment_owned(actor, assignment_id)
        rows, total = await self.assignments.list_course_feedback(
            a.id, a.course_id, page=page, page_size=page_size
        )
        items = []
        for enrollment, student, submission in rows:
            profile = getattr(student, "profile", None)
            name = (
                getattr(profile, "display_name", None)
                or getattr(profile, "full_name", None)
                or getattr(student, "email", None)
                or f"Student #{student.id}"
            )
            items.append({
                "student_id": student.id,
                "student_name": name,
                "student_email": student.email,
                "enrollment_status": enrollment.status.value if hasattr(enrollment.status, "value") else str(enrollment.status),
                "attempted": submission is not None,
                "submission_id": submission.id if submission else None,
                "submission_status": submission.status.value if submission and hasattr(submission.status, "value") else (str(submission.status) if submission else None),
                "score": submission.score if submission else None,
                "feedback": submission.feedback if submission else None,
                "submitted_at": submission.submitted_at if submission else None,
            })
        return items, total

    async def grade_submission(
        self,
        actor: User,
        submission_id: int,
        *,
        score: float,
        feedback: Optional[str],
        return_to_student: bool,
    ):
        sub = await self.assignments.get_submission(submission_id)
        if not sub:
            raise NotFoundError("Submission not found")
        a = await self._assert_assignment_owned(actor, sub.assignment_id)
        if score > a.max_score:
            raise ValidationError(f"score cannot exceed max_score ({a.max_score})")
        new_status = SubmissionStatus.RETURNED if return_to_student else SubmissionStatus.GRADED
        await self.assignments.grade_submission(
            sub, score=score, feedback=feedback, graded_by=actor.id, status=new_status,
        )
        await self.activity.record(
            student_id=sub.student_id,
            activity_type="assignment_graded",
            course_id=a.course_id,
            score=score,
            metadata={"assignment_id": a.id, "submission_id": sub.id},
        )
        await self.notifications.notify(
            user_id=sub.student_id,
            type="assignment_graded",
            title="Assignment graded",
            body=f"{a.title}: {score}/{a.max_score}",
            link_url=f"/student/assignments/{a.id}",
            metadata={"assignment_id": a.id, "submission_id": sub.id, "score": score},
        )
        await self.audit.log(
            action="assignment.graded", user_id=actor.id,
            entity_type="submission", entity_id=sub.id, metadata={"score": score},
        )
        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    # ---------------- Student ----------------
    async def list_for_student(self, actor: User) -> Sequence[Assignment]:
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students have assignment lists")
        enrs, _ = await self.enrollments.list_for_student(actor.id, page=1, page_size=500)
        course_ids = [c.id for e, c in enrs if e.status != EnrollmentStatus.DROPPED]
        return await self.assignments.list_published_for_student_courses(course_ids)

    async def get_for_student(self, actor: User, assignment_id: int) -> Assignment:
        a = await self.assignments.get(assignment_id)
        if not a or a.status != AssignmentStatus.PUBLISHED:
            raise NotFoundError("Assignment not found")
        if actor.role == UserRole.STUDENT:
            enr = await self.enrollments.get(actor.id, a.course_id)
            if not enr or enr.status == EnrollmentStatus.DROPPED:
                raise AuthorizationError("You are not enrolled in this course")
        return a

    async def submit(self, actor: User, assignment_id: int, data: dict):
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students can submit assignments")
        a = await self.assignments.get(assignment_id)
        if not a or a.status != AssignmentStatus.PUBLISHED:
            raise NotFoundError("Assignment not found")
        enr = await self.enrollments.get(actor.id, a.course_id)
        if not enr or enr.status == EnrollmentStatus.DROPPED:
            raise AuthorizationError("You are not enrolled in this course")

        if not data.get("content") and not data.get("file_url"):
            raise ValidationError("Submission must have content or file_url")

        now = datetime.now(timezone.utc)
        due_at = a.due_at
        if due_at is not None:
            # MySQL may return DateTime(timezone=True) values as naive datetimes.
            # Treat those persisted timestamps as UTC before comparing with the
            # timezone-aware current time. This prevents a valid submission from
            # failing with "can't compare offset-naive and offset-aware datetimes".
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)
            else:
                due_at = due_at.astimezone(timezone.utc)
        is_late = bool(due_at and now > due_at)
        if is_late and not a.allow_late:
            raise ConflictError("Assignment deadline passed; late submissions are not allowed")

        existing = await self.assignments.find_submission(a.id, actor.id)
        if existing:
            raise ConflictError("You have already attempted this assignment")

        status = SubmissionStatus.LATE if is_late else SubmissionStatus.SUBMITTED
        score = None
        feedback = None
        final_status = status
        if a.questions:
            import json
            try:
                payload = json.loads(data.get("content") or "{}")
                answers = payload.get("answers") or {}
            except (TypeError, ValueError, AttributeError):
                raise ValidationError("Invalid MCQ answer format")
            correct = 0
            for q in a.questions:
                if answers.get(q.get("id")) == q.get("correct_option"):
                    correct += 1
            score = round((correct / len(a.questions)) * float(a.max_score), 2)
            feedback = f"Auto-graded: {correct}/{len(a.questions)} correct."
            final_status = SubmissionStatus.LATE if is_late else SubmissionStatus.GRADED
            data = {**data, "content": data.get("content"), "file_url": None}
        sub = await self.assignments.create_submission(
            assignment_id=a.id, student_id=actor.id, data=data, status=final_status,
        )
        if score is not None:
            sub.score = score
            sub.feedback = feedback
            sub.graded_at = now
            sub.graded_by = None

        # Persist the core submission before recording optional learning
        # analytics. Older databases can be missing the optional metadata_json
        # column on learning_activity; that must never make a valid assignment
        # submission fail with a generic 500 error.
        await self.db.flush()
        try:
            async with self.db.begin_nested():
                await self.activity.record(
                    student_id=actor.id,
                    activity_type="assignment_submitted",
                    course_id=a.course_id,
                    completed=True,
                    metadata={"assignment_id": a.id, "submission_id": sub.id, "late": is_late},
                )
        except SQLAlchemyError:
            # Analytics are non-critical to the submission itself. The nested
            # transaction rolls back only the failed analytics write, while the
            # submission remains in the outer transaction and can be committed.
            pass

        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    async def get_my_submission(self, actor: User, assignment_id: int):
        if actor.role != UserRole.STUDENT:
            raise AuthorizationError("Only students have submissions")
        sub = await self.assignments.find_submission(assignment_id, actor.id)
        if not sub:
            raise NotFoundError("Submission not found")
        return sub