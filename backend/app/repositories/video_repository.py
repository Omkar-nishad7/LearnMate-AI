from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.video import ProcessingStatus, Video, VideoAnalysis, VideoSource
from app.models.video_state import VideoUserState


class VideoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, video_id: int, with_analysis: bool = False) -> Optional[Video]:
        stmt = select(Video).where(Video.id == video_id)
        if with_analysis:
            stmt = stmt.options(selectinload(Video.analyses))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_by_external_id(self, external_id: str) -> Optional[Video]:
        stmt = select(Video).where(
            Video.source == VideoSource.YOUTUBE, Video.external_id == external_id
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(
        self,
        *,
        owner_id: int,
        source: VideoSource,
        url: str,
        external_id: Optional[str] = None,
        lesson_id: Optional[int] = None,
        file_id: Optional[int] = None,
        title: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        status: ProcessingStatus = ProcessingStatus.PENDING,
    ) -> Video:
        v = Video(
            owner_id=owner_id,
            lesson_id=lesson_id,
            file_id=file_id,
            source=source,
            external_id=external_id,
            url=url,
            title=title,
            thumbnail_url=thumbnail_url,
            status=status,
        )
        self.db.add(v)
        await self.db.flush()
        return v

    async def delete(self, video: Video) -> None:
        await self.db.delete(video)
        await self.db.flush()

    async def set_status(
        self,
        video: Video,
        status: ProcessingStatus,
        *,
        error_message: Optional[str] = None,
    ) -> Video:
        video.status = status
        video.error_message = error_message
        await self.db.flush()
        return video

    async def set_metadata(
        self,
        video: Video,
        *,
        title: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        thumbnail_url: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Video:
        if title is not None:
            video.title = title
        if duration_seconds is not None:
            video.duration_seconds = duration_seconds
        if thumbnail_url is not None:
            video.thumbnail_url = thumbnail_url
        if description is not None:
            video.description = description
        await self.db.flush()
        return video

    async def upsert_analysis(
        self,
        video_id: int,
        *,
        transcript: Optional[str] = None,
        language: str = "en",
        model_used: Optional[str] = None,
        tokens_used: Optional[int] = None,
    ) -> VideoAnalysis:
        stmt = select(VideoAnalysis).where(VideoAnalysis.video_id == video_id)
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            if transcript is not None:
                existing.transcript = transcript
            existing.language = language
            if model_used:
                existing.model_used = model_used
            if tokens_used is not None:
                existing.tokens_used = tokens_used
            await self.db.flush()
            return existing
        analysis = VideoAnalysis(
            video_id=video_id,
            transcript=transcript,
            language=language,
            model_used=model_used,
            tokens_used=tokens_used,
            status=ProcessingStatus.COMPLETED if transcript else ProcessingStatus.PENDING,
        )
        self.db.add(analysis)
        await self.db.flush()
        return analysis

    async def get_analysis(self, video_id: int) -> Optional[VideoAnalysis]:
        stmt = select(VideoAnalysis).where(VideoAnalysis.video_id == video_id).order_by(VideoAnalysis.updated_at.desc())
        return (await self.db.execute(stmt)).scalars().first()

    async def mark_analysis_failed(self, video_id: int, error_message: str) -> VideoAnalysis:
        row = await self.get_analysis(video_id)
        if row is None:
            row = VideoAnalysis(video_id=video_id)
            self.db.add(row)
            await self.db.flush()
        row.status = ProcessingStatus.FAILED
        row.error_message = error_message[:1000]
        await self.db.flush()
        return row

    async def update_analysis_content(
        self, video_id: int, *, summary: Optional[str] = None, key_points: Optional[dict] = None,
        notes_json: Optional[dict] = None, quiz_json: Optional[dict] = None,
        model_used: Optional[str] = None, tokens_used: Optional[int] = None,
        transcript: Optional[str] = None, language: Optional[str] = None,
    ) -> VideoAnalysis:
        row = await self.get_analysis(video_id)
        if row is None:
            row = VideoAnalysis(video_id=video_id)
            self.db.add(row)
            await self.db.flush()
        if summary is not None: row.summary = summary
        if key_points is not None: row.key_points = key_points
        if notes_json is not None: row.notes_json = notes_json
        if quiz_json is not None: row.quiz_json = quiz_json
        if model_used is not None: row.model_used = model_used
        if tokens_used is not None: row.tokens_used = tokens_used
        if transcript is not None: row.transcript = transcript
        if language is not None: row.language = language
        row.status = ProcessingStatus.COMPLETED
        row.error_message = None
        await self.db.flush()
        return row

    async def update_transcript_status(
        self, analysis: VideoAnalysis, status: ProcessingStatus
    ) -> None:
        analysis.status = status
        await self.db.flush()
    async def get_user_state(self, user_id: int, video_id: int) -> Optional[VideoUserState]:
        stmt = select(VideoUserState).where(
            VideoUserState.user_id == user_id,
            VideoUserState.video_id == video_id,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def upsert_user_state(
        self,
        *,
        user_id: int,
        video_id: int,
        saved_for_later: Optional[bool] = None,
        last_position_seconds: Optional[int] = None,
        watched_seconds: Optional[int] = None,
        duration_seconds: Optional[int] = None,
        is_completed: Optional[bool] = None,
    ) -> VideoUserState:
        row = await self.get_user_state(user_id, video_id)
        from datetime import datetime, timezone
        if row is None:
            row = VideoUserState(user_id=user_id, video_id=video_id)
            self.db.add(row)
            await self.db.flush()
        if saved_for_later is not None:
            row.saved_for_later = saved_for_later
        if last_position_seconds is not None:
            row.last_position_seconds = max(0, last_position_seconds)
        if watched_seconds is not None:
            row.watched_seconds = max(row.watched_seconds, watched_seconds)
        if duration_seconds is not None and duration_seconds > 0:
            row.duration_seconds = duration_seconds
        if is_completed is not None:
            row.is_completed = is_completed or row.is_completed
        if row.duration_seconds:
            row.progress_percent = min(
                100.0,
                max(0.0, row.last_position_seconds / max(row.duration_seconds, 1) * 100.0),
            )
            if row.progress_percent >= 90.0:
                row.progress_percent = 100.0
                row.is_completed = True
        row.last_watched_at = datetime.now(timezone.utc)
        await self.db.flush()
        return row

    async def list_saved_for_user(self, user_id: int, *, page: int = 1, page_size: int = 30) -> tuple[list[Video], int]:
        base = (
            select(Video)
            .join(VideoUserState, VideoUserState.video_id == Video.id)
            .where(
                VideoUserState.user_id == user_id,
                VideoUserState.saved_for_later.is_(True),
            )
            .order_by(VideoUserState.updated_at.desc())
        )
        count_stmt = (
            select(func.count())
            .select_from(VideoUserState)
            .where(
                VideoUserState.user_id == user_id,
                VideoUserState.saved_for_later.is_(True),
            )
        )
        total = int((await self.db.execute(count_stmt)).scalar_one())
        rows = (
            await self.db.execute(
                base.offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars().all()
        return list(rows), total

    async def list_for_owner(self, owner_id: int, *, page: int = 1, page_size: int = 30) -> tuple[list[Video], int]:
        base = select(Video).where(Video.owner_id == owner_id).order_by(Video.created_at.desc())
        total = int((await self.db.execute(select(func.count()).select_from(Video).where(Video.owner_id == owner_id))).scalar_one())
        rows = (await self.db.execute(base.offset((page - 1) * page_size).limit(page_size))).scalars().all()
        return list(rows), total
