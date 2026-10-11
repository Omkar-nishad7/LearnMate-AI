from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.logging import get_logger
from app.config.settings import settings
from app.core.exceptions import (
    AuthorizationError,
    NotFoundError,
    ValidationError,
)
from app.core.youtube import extract_video_id, fetch_metadata
from app.models.user import User, UserRole
from app.models.video import ProcessingStatus, Video, VideoSource
from app.repositories.course_repository import CourseRepository
from app.repositories.enrollment_repository import EnrollmentRepository
from app.models.course import EnrollmentStatus
from app.repositories.lesson_repository import LessonRepository
from app.repositories.module_repository import ModuleRepository
from app.repositories.video_repository import VideoRepository
from app.services.audit_service import AuditService
from app.services.file_service import FileService

logger = get_logger("video")


class VideoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.videos = VideoRepository(db)
        self.lessons = LessonRepository(db)
        self.modules = ModuleRepository(db)
        self.courses = CourseRepository(db)
        self.enrollments = EnrollmentRepository(db)
        self.audit = AuditService(db)

    async def _assert_lesson_owned(self, actor: User, lesson_id: int) -> None:
        lesson = await self.lessons.get_by_id(lesson_id)
        if not lesson:
            raise NotFoundError("Lesson not found")
        module = await self.modules.get_by_id(lesson.module_id)
        if not module:
            raise NotFoundError("Module not found")
        course = await self.courses.get_by_id(module.course_id)
        if not course:
            raise NotFoundError("Course not found")
        if actor.role != UserRole.ADMIN and course.teacher_id != actor.id:
            raise AuthorizationError("You do not own this course")

    async def create_from_youtube(
        self,
        actor: User,
        *,
        url: str,
        lesson_id: Optional[int] = None,
    ) -> tuple[Video, bool]:
        if actor.role not in (UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("You cannot add videos")

        # Student YouTube imports are personal learning resources. They must
        # never become teacher course attachments or appear in teacher course
        # video management. Teacher course videos are created/attached only
        # through the teacher workflow.
        if actor.role == UserRole.STUDENT and lesson_id is not None:
            raise AuthorizationError("Student YouTube imports cannot be attached to teacher courses")

        if lesson_id is not None:
            await self._assert_lesson_owned(actor, lesson_id)

        external_id = extract_video_id(url)
        existing = await self.videos.get_by_external_id(external_id)

        if existing and existing.owner_id == actor.id:
            # Repair older imports that were stored with the placeholder title.
            if not existing.title or existing.title.startswith("YouTube video "):
                try:
                    meta = await fetch_metadata(external_id)
                    if meta.title:
                        existing.title = meta.title
                    if meta.description:
                        existing.description = meta.description
                    if meta.thumbnail_url:
                        existing.thumbnail_url = meta.thumbnail_url
                    if meta.duration_seconds:
                        existing.duration_seconds = meta.duration_seconds
                except Exception:
                    pass

            old_lesson_id = existing.lesson_id
            if old_lesson_id != lesson_id:
                if old_lesson_id is not None:
                    old_lesson = await self.lessons.get_by_id(old_lesson_id)
                    if old_lesson and old_lesson.video_url == existing.url:
                        old_lesson.video_url = None
                existing.lesson_id = lesson_id
                if lesson_id is not None:
                    new_lesson = await self.lessons.get_by_id(lesson_id)
                    if new_lesson:
                        new_lesson.video_url = existing.url
                await self.db.flush()

            if existing.status == ProcessingStatus.FAILED:
                await self.videos.set_status(existing, ProcessingStatus.PENDING, error_message=None)
                await self.db.commit()
                await self.db.refresh(existing)
                return existing, True

            await self.db.commit()
            await self.db.refresh(existing)
            return existing, False

        # Resolve the real YouTube title before the card is returned. The
        # background worker will enrich it again if the first metadata request
        # is unavailable.
        try:
            meta = await fetch_metadata(external_id)
        except Exception:
            meta = None

        video = await self.videos.create(
            owner_id=actor.id,
            source=VideoSource.YOUTUBE,
            url=url.strip(),
            external_id=external_id,
            lesson_id=lesson_id,
            title=(meta.title if meta else None) or f"YouTube video {external_id}",
            thumbnail_url=(meta.thumbnail_url if meta else None) or f"https://i.ytimg.com/vi/{external_id}/hqdefault.jpg",
            status=ProcessingStatus.PENDING,
        )
        if meta:
            video.description = meta.description or None
            video.duration_seconds = meta.duration_seconds
        if lesson_id is not None:
            lesson = await self.lessons.get_by_id(lesson_id)
            if lesson:
                lesson.video_url = video.url
                await self.db.flush()

        await self.audit.log(
            action="video.created",
            user_id=actor.id,
            entity_type="video",
            entity_id=video.id,
            metadata={"source": "YOUTUBE", "external_id": external_id},
        )
        await self.db.commit()
        await self.db.refresh(video)
        return video, True

    async def update_video(self, actor: User, video_id: int, data: dict) -> Video:
        """Update teacher-owned video metadata/lesson attachment safely."""
        video = await self._get_owned_video(actor, video_id)
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can edit course videos")

        new_lesson_id = data.get("lesson_id", video.lesson_id)
        if new_lesson_id is not None:
            await self._assert_lesson_owned(actor, new_lesson_id)

        old_lesson_id = video.lesson_id
        if old_lesson_id != new_lesson_id:
            if old_lesson_id is not None:
                old_lesson = await self.lessons.get_by_id(old_lesson_id)
                if old_lesson and old_lesson.video_url == video.url:
                    old_lesson.video_url = None
            video.lesson_id = new_lesson_id
            if new_lesson_id is not None:
                new_lesson = await self.lessons.get_by_id(new_lesson_id)
                if new_lesson:
                    new_lesson.video_url = video.url

        if "title" in data and data["title"] is not None:
            video.title = data["title"].strip()
        if "description" in data:
            video.description = data["description"]

        await self.audit.log(
            action="video.updated",
            user_id=actor.id,
            entity_type="video",
            entity_id=video.id,
            metadata={"lesson_id": new_lesson_id},
        )
        await self.db.commit()
        await self.db.refresh(video)
        return video

    async def create_from_upload(self, actor: User, *, filename: str, data: bytes, mime_type: Optional[str], lesson_id: Optional[int] = None) -> Video:
        if actor.role not in (UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("Only teachers can upload course videos")
        if not data:
            raise ValidationError("Empty video file")
        if len(data) > settings.MAX_VIDEO_UPLOAD_BYTES:
            raise ValidationError("Video exceeds the configured upload limit")
        if lesson_id is not None:
            await self._assert_lesson_owned(actor, lesson_id)
        file = await FileService(self.db).upload(
            actor, filename=filename, data=data, declared_content_type=mime_type,
            category="video", is_public=False,
        )
        url = await FileService(self.db).url_for(file)
        video = await self.videos.create(
            owner_id=actor.id, source=VideoSource.UPLOAD, url=url,
            file_id=file.id, lesson_id=lesson_id, title=filename,
            status=ProcessingStatus.PENDING,
        )
        await self.audit.log(action="video.uploaded", user_id=actor.id, entity_type="video", entity_id=video.id)
        await self.db.commit()
        await self.db.refresh(video)
        return video

    async def list_mine(self, actor: User, *, page: int = 1, page_size: int = 30):
        rows, total = await self.videos.list_for_owner(actor.id, page=page, page_size=page_size)
        return rows, total

    async def list_saved(self, actor: User, *, page: int = 1, page_size: int = 30):
        return await self.videos.list_saved_for_user(actor.id, page=page, page_size=page_size)

    async def _get_owned_video(self, actor: User, video_id: int) -> Video:
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise NotFoundError("Video not found")
        if actor.role != UserRole.ADMIN and video.owner_id != actor.id:
            raise AuthorizationError("You do not own this video")
        return video

    async def delete_video(self, actor: User, video_id: int) -> None:
        video = await self._get_owned_video(actor, video_id)

        # Students may delete only their own imported YouTube videos.
        if actor.role == UserRole.STUDENT and video.source != VideoSource.YOUTUBE:
            raise AuthorizationError("Students can delete only imported YouTube videos")
        if actor.role not in (UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN):
            raise AuthorizationError("You cannot delete this video")

        file_id = video.file_id

        if video.lesson_id is not None:
            lesson = await self.lessons.get_by_id(video.lesson_id)
            if lesson and lesson.video_url == video.url:
                lesson.video_url = None

        # Uploaded course videos have a storage object; YouTube imports do not.
        if file_id and actor.role in (UserRole.TEACHER, UserRole.ADMIN):
            try:
                await FileService(self.db).delete(actor, file_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("video_file_delete_failed", video_id=video_id, file_id=file_id, error=str(exc))

        await self.videos.delete(video)
        await self.audit.log(
            action="video.deleted",
            user_id=actor.id,
            entity_type="video",
            entity_id=video_id,
            metadata={"file_id": file_id} if file_id else {"source": video.source.value},
        )
        await self.db.commit()

    async def get_for_viewer(self, actor: User, video_id: int, with_transcript: bool = False) -> Video:
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise NotFoundError("Video not found")

        # Owner / admin full access
        if actor.role == UserRole.ADMIN or video.owner_id == actor.id:
            return video

        # Students: only if video is attached to a lesson of a published course
        # and the student is enrolled — reuses course_service logic in M3.
        # Here we accept authenticated access to non-FAILED videos attached to lessons.
        if video.lesson_id is not None:
            lesson = await self.lessons.get_by_id(video.lesson_id)
            if lesson:
                module = await self.modules.get_by_id(lesson.module_id)
                if module:
                    course = await self.courses.get_by_id(module.course_id)
                    if course and course.status.value == "PUBLISHED":
                        enrollment = await self.enrollments.get(actor.id, course.id)
                        if enrollment and enrollment.status != EnrollmentStatus.DROPPED:
                            return video
        raise AuthorizationError("You do not have access to this video")

    async def get_status(self, actor: User, video_id: int) -> dict:
        video = await self.get_for_viewer(actor, video_id)
        analysis = await self.videos.get_analysis(video_id)

        task_state: Optional[str] = None
        # Inspect Celery for latest task state without blocking
        try:
            from app.workers.celery_app import celery_app
            from celery.result import AsyncResult

            if video.external_id:
                # We don't persist task_id in Video table (see Known Limitations)
                # Best-effort: nothing to query. Fall through gracefully.
                task_state = None
        except Exception:  # noqa: BLE001
            task_state = None

        return {
            "video_id": video.id,
            "status": video.status,
            "task_state": task_state,
            "has_transcript": bool(analysis and analysis.transcript),
            "analysis_status": analysis.status if analysis else ProcessingStatus.PENDING,
            "ai_ready": bool(analysis and analysis.status == ProcessingStatus.COMPLETED and analysis.summary),
            "error_message": video.error_message,
            "analysis_error": analysis.error_message if analysis else None,
        }

    async def get_detail(self, actor: User, video_id: int) -> dict:
        video = await self.get_for_viewer(actor, video_id)
        analysis = await self.videos.get_analysis(video_id)
        state = await self.videos.get_user_state(actor.id, video_id)
        return {"video": video, "analysis": analysis, "state": state}

    async def get_state(self, actor: User, video_id: int):
        await self.get_for_viewer(actor, video_id)
        return await self.videos.get_user_state(actor.id, video_id)

    async def update_state(self, actor: User, video_id: int, **changes):
        video = await self.get_for_viewer(actor, video_id)
        if changes.get("duration_seconds") is None and video.duration_seconds:
            changes["duration_seconds"] = video.duration_seconds
        if changes.get("last_position_seconds") is not None and video.duration_seconds:
            changes["last_position_seconds"] = min(changes["last_position_seconds"], video.duration_seconds)
        state = await self.videos.upsert_user_state(user_id=actor.id, video_id=video.id, **changes)
        await self.db.commit()
        await self.db.refresh(state)
        return state

    # -------- Worker entry point (called by Celery task) --------
    async def mark_processing(self, video_id: int) -> Optional[Video]:
        video = await self.videos.get_by_id(video_id)
        if not video:
            return None
        await self.videos.set_status(video, ProcessingStatus.PROCESSING)
        await self.db.commit()
        await self.db.refresh(video)
        return video

    async def mark_source_ready(
        self,
        video_id: int,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        thumbnail_url: Optional[str] = None,
    ) -> None:
        """Persist source metadata and mark the video itself as available.

        AI analysis is handled separately, so an optional AI failure should not
        make a valid YouTube source appear as a failed video.
        """
        video = await self.videos.get_by_id(video_id)
        if video is None:
            return

        await self.videos.set_metadata(
            video,
            title=title,
            description=description,
            duration_seconds=duration_seconds,
            thumbnail_url=thumbnail_url,
        )
        await self.videos.set_status(
            video,
            ProcessingStatus.COMPLETED,
            error_message=None,
        )
        await self.db.commit()

    async def mark_analysis_ready(
        self,
        video_id: int,
        *,
        transcript: Optional[str] = None,
        language: str = "auto",
        summary: Optional[str] = None,
        key_points: Optional[dict] = None,
        notes_json: Optional[dict] = None,
        quiz_json: Optional[dict] = None,
        model_used: Optional[str] = None,
        tokens_used: Optional[int] = None,
    ) -> None:
        """Persist transcript/AI output without coupling it to source status."""
        await self.videos.update_analysis_content(
            video_id,
            transcript=transcript,
            language=language,
            summary=summary,
            key_points=key_points,
            notes_json=notes_json,
            quiz_json=quiz_json,
            model_used=model_used,
            tokens_used=tokens_used,
        )
        await self.db.commit()

    async def mark_completed(
        self,
        video_id: int,
        *,
        transcript: str,
        language: str,
        title: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        thumbnail_url: Optional[str] = None,
    ) -> None:
        video = await self.videos.get_by_id(video_id)
        if not video:
            return
        await self.videos.set_metadata(
            video,
            title=title,
            duration_seconds=duration_seconds,
            thumbnail_url=thumbnail_url,
        )
        await self.videos.upsert_analysis(
            video.id,
            transcript=transcript,
            language=language,
            model_used="youtube-transcript-api",
        )
        await self.videos.set_status(video, ProcessingStatus.COMPLETED)
        await self.db.commit()

    async def mark_failed(self, video_id: int, error: str) -> None:
        video = await self.videos.get_by_id(video_id)
        if not video:
            return
        await self.videos.set_status(video, ProcessingStatus.FAILED, error_message=error[:500])
        await self.db.commit()