from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_exceptions import AIInvalidOutputError
from app.models.note import Note, NoteVersion
from app.repositories.video_repository import VideoRepository
from app.models.video import VideoSource
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.schemas import NotesOutput
from app.services.ai.usage import check_and_increment, log_usage


class NotesAIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.videos = VideoRepository(db)

    async def generate_for_video(
        self, *, user_id: int, video_id: int, course_id: int | None = None
    ) -> Note:
        await check_and_increment("notes", user_id)

        analysis = await self.videos.get_analysis(video_id)
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise AIInvalidOutputError("Video not found")

        use_direct_youtube = video.source == VideoSource.YOUTUBE and not (analysis and analysis.transcript)
        if use_direct_youtube:
            prompt = (
                "You are an expert note-taker for students. Analyze the entire public YouTube video at this URL "
                "and create concise revision-ready notes. Return STRICT JSON with title, content_markdown, key_terms. "
                "Do not invent facts outside the video. URL: " + video.url
            )
        else:
            if not analysis or not analysis.transcript:
                raise AIInvalidOutputError("Video has no transcript yet")
            prompt = render_prompt("notes", transcript=analysis.transcript[:60000])

        try:
            if use_direct_youtube:
                raw, tokens = GeminiClient().analyze_youtube_json(youtube_url=video.url, prompt=prompt)
            else:
                raw, tokens = GeminiClient().generate_json(prompt=prompt, max_output_tokens=4096)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="notes",
                status="FAILED", error_message=str(e),
                metadata={"video_id": video_id},
            )
            await self.db.commit()
            raise

        try:
            data = NotesOutput.model_validate(raw)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="notes",
                status="INVALID_OUTPUT", error_message=str(e),
                metadata={"video_id": video_id},
            )
            await self.db.commit()
            raise AIInvalidOutputError(f"Notes schema invalid: {e}")

        note = Note(
            user_id=user_id,
            course_id=course_id,
            video_id=video_id,
            title=data.title,
            content=data.content_markdown,
            is_ai_generated=True,
            tags={"key_terms": [kt.model_dump() for kt in data.key_terms]},
            current_version=1,
        )
        self.db.add(note)
        await self.db.flush()

        # initial version snapshot
        self.db.add(
            NoteVersion(
                note_id=note.id, version_number=1, title=note.title,
                content=note.content, edited_by=user_id,
            )
        )
        await self.db.flush()

        await log_usage(
            self.db, user_id=user_id, feature="notes",
            status="SUCCESS", tokens_used=tokens, metadata={"video_id": video_id},
        )
        await self.db.commit()
        await self.db.refresh(note)
        return note