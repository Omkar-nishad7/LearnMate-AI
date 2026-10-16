from typing import Optional
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.logging import get_logger
from app.config.settings import settings
from app.core.ai_exceptions import AIInvalidOutputError
from app.models.ai import AIConversation, AIMessage
from app.repositories.ai_repository import AIRepository
from app.repositories.course_repository import CourseRepository
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.usage import check_and_increment, log_usage

logger = get_logger("ai.tutor")

_MAX_HISTORY_MESSAGES = 12  # keep prompt bounded


class TutorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai = AIRepository(db)
        self.courses = CourseRepository(db)

    async def ask(
        self,
        *,
        user_id: int,
        message: str,
        conversation_id: Optional[int] = None,
        course_id: Optional[int] = None,
        video_id: Optional[int] = None,
        playback_position_seconds: Optional[int] = None,
    ) -> tuple[AIConversation, AIMessage]:
        if not message.strip():
            raise AIInvalidOutputError("Message cannot be empty")

        await check_and_increment("tutor", user_id)

        # Fetch or create conversation
        conv: Optional[AIConversation] = None
        if conversation_id is not None:
            conv = await self.ai.get_conversation(conversation_id, with_messages=False)
            if not conv or conv.user_id != user_id:
                # do not leak existence; start new
                conv = None
        if conv is None:
            title = message.strip().split("\n")[0][:80]
            conv = await self.ai.create_conversation(
                user_id=user_id, feature="tutor", title=title or "New Conversation",
                course_id=course_id,
            )

        # Persist user message
        await self.ai.add_message(
            conversation_id=conv.id, role="user", content=message.strip()
        )

        # Build prompt
        course_context = ""
        cid = course_id or conv.course_id
        if cid:
            course = await self.courses.get_by_id(cid)
            if course:
                course_context = f"{course.title}\n{course.short_description or ''}".strip()

        history_msgs = await self.ai.get_messages(conv.id, limit=_MAX_HISTORY_MESSAGES + 1)
        history_lines = []
        for m in history_msgs[:-1]:  # exclude the just-added user message
            prefix = "Student" if m.role == "user" else "Tutor"
            history_lines.append(f"{prefix}: {m.content}")
        history = "\n".join(history_lines) or "(none)"

        video_context = ""
        if video_id is not None:
            video = await self.ai.get_video_context(video_id)
            if video:
                transcript = video.get("transcript") or ""
                duration = int(video.get("duration_seconds") or 0)
                position = int(playback_position_seconds or 0)
                if duration and transcript:
                    ratio = min(1.0, max(0.0, position / duration))
                    center = int(len(transcript) * ratio)
                    window = max(2500, min(9000, len(transcript) // 6 or 2500))
                    start = max(0, center - window // 2)
                    end = min(len(transcript), center + window // 2)
                    transcript_context = transcript[start:end]
                else:
                    transcript_context = transcript[:9000]

                summary = video.get("summary") or "(no full-video summary available)"
                key_points = video.get("key_points") or {}
                chapters = key_points.get("chapters") if isinstance(key_points, dict) else []
                chapter_context = ""
                if chapters:
                    nearby = []
                    for chapter in chapters:
                        try:
                            start_s = float(chapter.get("start_seconds", 0))
                            end_s = float(chapter.get("end_seconds", 0))
                            if start_s <= position <= (end_s or position + 1) or abs(start_s - position) <= 120:
                                nearby.append(chapter)
                        except Exception:
                            continue
                    if nearby:
                        chapter_context = "\n".join(
                            f"- {c.get('title', 'Chapter')} ({c.get('start_seconds', 0)}s): {c.get('summary', '')}"
                            for c in nearby[:3]
                        )
                video_context = (
                    f"Video: {video.get('title') or 'Current video'}\n"
                    f"Playback position: {position}s / {duration or 'unknown'}s\n"
                    f"Whole-video AI summary:\n{summary}\n"
                    f"Relevant chapter context:\n{chapter_context or '(none)'}\n"
                    f"Relevant transcript context:\n{transcript_context or '(none)'}"
                )

        prompt = render_prompt(
            "tutor", course_context=course_context or "(none)",
            history=history, user_message=message.strip(),
            video_context=video_context or "(no video context)",
        )

        try:
            text, tokens = await GeminiClient(
                model=settings.GEMINI_TUTOR_MODEL
            ).generate_text_async(
                prompt=prompt, temperature=0.5, max_output_tokens=2048
            )
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="tutor",
                status="FAILED", error_message=str(e),
            )
            await self.db.commit()
            raise

        assistant_msg = await self.ai.add_message(
            conversation_id=conv.id, role="assistant", content=text,
            tokens_used=tokens, model="gemini",
        )
        await log_usage(
            self.db, user_id=user_id, feature="tutor",
            status="SUCCESS", tokens_used=tokens,
        )
        await self.db.commit()
        await self.db.refresh(conv)
        await self.db.refresh(assistant_msg)
        return conv, assistant_msg