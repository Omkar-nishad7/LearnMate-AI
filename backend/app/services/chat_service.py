from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.models.chat import Conversation, Message
from app.models.course import CourseStatus, EnrollmentStatus
from app.models.user import User, UserRole
from app.repositories.chat_repository import ChatRepository
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.user_repository import UserRepository
from app.services.notification_service import NotificationService


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chat = ChatRepository(db)
        self.users = UserRepository(db)
        self.courses = CourseRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.notifications = NotificationService(db)

    # ---------------- Participants ----------------
    def _is_participant(self, conv: Conversation, user_id: int) -> bool:
        return user_id in (conv.user_a_id, conv.user_b_id)

    async def _require_participant(self, user: User, conversation_id: int) -> Conversation:
        conv = await self.chat.get(conversation_id)
        if not conv:
            raise NotFoundError("Conversation not found")
        if not self._is_participant(conv, user.id):
            # 404 to avoid leaking existence
            raise NotFoundError("Conversation not found")
        return conv

    # ---------------- Rules for opening a conversation ----------------
    async def _can_chat_with(
        self, actor: User, other: User, course_id: Optional[int]
    ) -> None:
        if actor.id == other.id:
            raise ValidationError("You cannot start a conversation with yourself")

        # Admin can chat with anyone (support channel).
        if actor.role == UserRole.ADMIN:
            return

        # Roles must be complementary
        if {actor.role, other.role} != {UserRole.STUDENT, UserRole.TEACHER}:
            raise AuthorizationError("Chat is only between students and teachers")

        student = actor if actor.role == UserRole.STUDENT else other
        teacher = other if actor.role == UserRole.STUDENT else actor

        if course_id is not None:
            course = await self.courses.get_by_id(course_id)
            if not course or course.teacher_id != teacher.id:
                raise AuthorizationError("Teacher does not own the given course")
            enr = await self.enrollments.get(student.id, course.id)
            if not enr or enr.status == EnrollmentStatus.DROPPED:
                raise AuthorizationError("Student is not enrolled in that course")
            return

        # course_id is None: allow if there is *any* published course by teacher
        # in which student is enrolled
        enrs, _ = await self.enrollments.list_for_student(student.id, page=1, page_size=200)
        for _enr, c in enrs:
            if c.teacher_id == teacher.id and c.status == CourseStatus.PUBLISHED:
                return
        raise AuthorizationError("No shared course between these users")

    # ---------------- Open / get ----------------
    async def open_conversation(
        self, actor: User, *, other_user_id: int, course_id: Optional[int] = None
    ) -> Conversation:
        other = await self.users.get_by_id(other_user_id)
        if not other:
            raise NotFoundError("User not found")
        await self._can_chat_with(actor, other, course_id)

        existing = await self.chat.find_pair(actor.id, other.id, course_id)
        if existing:
            return existing

        conv = await self.chat.create(actor.id, other.id, course_id)
        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def list_conversations(
        self, user: User, *, page: int = 1, page_size: int = 20
    ) -> tuple[list[dict], int]:
        convs, total = await self.chat.list_for_user(user.id, page=page, page_size=page_size)
        out = []
        for c in convs:
            other_id = c.user_b_id if c.user_a_id == user.id else c.user_a_id
            other = await self.users.get_by_id(other_id)
            last = await self.chat.last_message(c.id)
            unread = await self.chat.unread_count_for_user_in_conversation(c.id, user.id)
            course = await self.courses.get_by_id(c.course_id) if c.course_id else None
            out.append({
                "conv": c,
                "course_title": course.title if course else None,
                "other_user_id": other_id,
                "other_user_name": (
                    other.profile.full_name if other and other.profile else None
                ),
                "last_message_body": last.body if last else None,
                "last_message_sender_id": last.sender_id if last else None,
                "unread_count": unread,
            })
        return out, total

    async def get_conversation_detail(self, user: User, conversation_id: int) -> dict:
        conv = await self._require_participant(user, conversation_id)
        other_id = conv.user_b_id if conv.user_a_id == user.id else conv.user_a_id
        other = await self.users.get_by_id(other_id)
        unread = await self.chat.unread_count_for_user_in_conversation(conv.id, user.id)
        course = await self.courses.get_by_id(conv.course_id) if conv.course_id else None
        return {
            "conv": conv,
            "course_title": course.title if course else None,
            "other_user_id": other_id,
            "other_user_name": (
                other.profile.full_name if other and other.profile else None
            ),
            "unread_count": unread,
        }

    # ---------------- Messages ----------------
    async def send_message(
        self, user: User, conversation_id: int, body: str
    ) -> Message:
        conv = await self._require_participant(user, conversation_id)
        body = body.strip()
        if not body:
            raise ValidationError("Message body cannot be empty")

        msg = await self.chat.add_message(
            conversation_id=conv.id, sender_id=user.id, body=body
        )
        await self.chat.touch(conv)

        recipient_id = conv.user_b_id if conv.user_a_id == user.id else conv.user_a_id
        # In-app notification
        await self.notifications.notify(
            user_id=recipient_id,
            type="teacher_message" if user.role == UserRole.TEACHER else "student_message",
            title=f"New message from {'teacher' if user.role == UserRole.TEACHER else 'student'}",
            body=body[:140],
            link_url=f"/messages?conversation_id={conv.id}",
            metadata={"conversation_id": conv.id, "message_id": msg.id},
        )

        await self.db.commit()
        await self.db.refresh(msg)
        await self.db.refresh(conv)
        return msg

    async def list_messages(
        self,
        user: User,
        conversation_id: int,
        *,
        before_id: Optional[int] = None,
        limit: int = 30,
    ) -> tuple[Sequence[Message], bool]:
        await self._require_participant(user, conversation_id)
        return await self.chat.list_messages(conversation_id, before_id=before_id, limit=limit)

    async def mark_conversation_read(self, user: User, conversation_id: int) -> int:
        await self._require_participant(user, conversation_id)
        n = await self.chat.mark_read_in_conversation(conversation_id, user.id)
        await self.db.commit()
        return n

    async def total_unread(self, user: User) -> int:
        return await self.chat.total_unread_for_user(user.id)