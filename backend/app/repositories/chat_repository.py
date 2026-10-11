from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Conversation, Message


def _pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- Conversations ----------------
    async def find_pair(
        self, user_x: int, user_y: int, course_id: Optional[int] = None
    ) -> Optional[Conversation]:
        a, b = _pair(user_x, user_y)
        stmt = select(Conversation).where(
            Conversation.user_a_id == a, Conversation.user_b_id == b
        )
        if course_id is not None:
            stmt = stmt.where(Conversation.course_id == course_id)
        else:
            stmt = stmt.where(Conversation.course_id.is_(None))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(
        self, user_x: int, user_y: int, course_id: Optional[int] = None
    ) -> Conversation:
        a, b = _pair(user_x, user_y)
        conv = Conversation(user_a_id=a, user_b_id=b, course_id=course_id)
        self.db.add(conv)
        await self.db.flush()
        return conv

    async def get(self, conversation_id: int) -> Optional[Conversation]:
        return (
            await self.db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
        ).scalar_one_or_none()

    async def list_for_user(
        self, user_id: int, *, page: int = 1, page_size: int = 20
    ) -> tuple[Sequence[Conversation], int]:
        stmt = select(Conversation).where(
            or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id)
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.db.execute(count_stmt)).scalar_one())
        stmt = stmt.order_by(
            Conversation.last_message_at.desc().nullslast(),
            Conversation.created_at.desc(),
        )
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def touch(self, conv: Conversation) -> None:
        conv.last_message_at = datetime.now(timezone.utc)
        await self.db.flush()

    # ---------------- Messages ----------------
    async def add_message(
        self, *, conversation_id: int, sender_id: int, body: str
    ) -> Message:
        m = Message(conversation_id=conversation_id, sender_id=sender_id, body=body)
        self.db.add(m)
        await self.db.flush()
        return m

    async def list_messages(
        self,
        conversation_id: int,
        *,
        before_id: Optional[int] = None,
        limit: int = 30,
    ) -> tuple[Sequence[Message], bool]:
        stmt = select(Message).where(Message.conversation_id == conversation_id)
        if before_id is not None:
            stmt = stmt.where(Message.id < before_id)
        stmt = stmt.order_by(Message.id.desc()).limit(limit + 1)
        rows = list((await self.db.execute(stmt)).scalars().all())
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        # return in ascending order for the UI
        rows.reverse()
        return rows, has_more

    async def last_message(self, conversation_id: int) -> Optional[Message]:
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.id.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def unread_count_for_user_in_conversation(
        self, conversation_id: int, user_id: int
    ) -> int:
        stmt = select(func.count()).select_from(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_read.is_(False),
            )
            .subquery()
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def total_unread_for_user(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(
            select(Message)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                or_(
                    Conversation.user_a_id == user_id,
                    Conversation.user_b_id == user_id,
                ),
                Message.sender_id != user_id,
                Message.is_read.is_(False),
            )
            .subquery()
        )
        return int((await self.db.execute(stmt)).scalar_one())

    async def mark_read_in_conversation(
        self, conversation_id: int, reader_id: int
    ) -> int:
        now = datetime.now(timezone.utc)
        stmt = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != reader_id,
                Message.is_read.is_(False),
            )
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        for m in rows:
            m.is_read = True
            m.read_at = now
        await self.db.flush()
        return len(rows)