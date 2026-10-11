from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai import AIConversation, AIMessage


class AIRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- Conversations ----------------
    async def create_conversation(
        self,
        *,
        user_id: int,
        feature: str,
        title: str = "New Conversation",
        course_id: Optional[int] = None,
    ) -> AIConversation:
        conv = AIConversation(
            user_id=user_id, feature=feature, title=title, course_id=course_id
        )
        self.db.add(conv)
        await self.db.flush()
        return conv

    async def get_conversation(
        self, conv_id: int, with_messages: bool = False
    ) -> Optional[AIConversation]:
        stmt = select(AIConversation).where(AIConversation.id == conv_id)
        if with_messages:
            stmt = stmt.options(selectinload(AIConversation.messages))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_conversations(
        self,
        user_id: int,
        *,
        feature: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[AIConversation], int]:
        stmt = select(AIConversation).where(
            AIConversation.user_id == user_id,
            AIConversation.is_archived.is_(False),
        )
        if feature:
            stmt = stmt.where(AIConversation.feature == feature)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = stmt.order_by(AIConversation.updated_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def update_conversation_title(self, conv: AIConversation, title: str) -> None:
        conv.title = title[:300]
        await self.db.flush()

    async def archive_conversation(self, conv: AIConversation) -> None:
        conv.is_archived = True
        await self.db.flush()

    # ---------------- Messages ----------------
    async def add_message(
        self,
        *,
        conversation_id: int,
        role: str,
        content: str,
        tokens_used: Optional[int] = None,
        model: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> AIMessage:
        msg = AIMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tokens_used=tokens_used,
            model=model,
            metadata_json=metadata,
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def get_messages(self, conversation_id: int, limit: int = 50) -> Sequence[AIMessage]:
        stmt = (
            select(AIMessage)
            .where(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.id.asc())
            .limit(limit)
        )
        return (await self.db.execute(stmt)).scalars().all()
    async def get_video_context(self, video_id: int) -> Optional[dict]:
        from sqlalchemy import select
        from app.models.video import Video, VideoAnalysis

        stmt = (
            select(Video, VideoAnalysis)
            .outerjoin(VideoAnalysis, VideoAnalysis.video_id == Video.id)
            .where(Video.id == video_id)
        )
        row = (await self.db.execute(stmt)).first()
        if not row:
            return None
        video, analysis = row
        return {
            "title": video.title,
            "duration_seconds": video.duration_seconds,
            "transcript": analysis.transcript if analysis else None,
            "summary": analysis.summary if analysis else None,
            "key_points": analysis.key_points if analysis else None,
            "notes_json": analysis.notes_json if analysis else None,
        }
