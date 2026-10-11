from __future__ import annotations

from typing import Optional

from sqlalchemy import Text, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.course import Course, CourseModule, CourseLesson, CourseStatus, Enrollment, EnrollmentStatus
from app.models.note import Note
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.models.video import Video, VideoAnalysis
from app.models.teacher_youtube_channel import TeacherYouTubeChannel
from app.services.youtube_search_service import YouTubeSearchService


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_internal(self, actor: User, query: str, limit: int = 10) -> dict:
        q = query.strip()
        like = f"%{q}%"

        course_stmt = select(Course).where(
            Course.status == CourseStatus.PUBLISHED,
            or_(
                Course.title.like(like),
                Course.short_description.like(like),
                Course.description.like(like),
                Course.category.like(like),
            ),
        ).order_by(Course.created_at.desc()).limit(min(100, max(50, limit)))
        courses = (await self.db.execute(course_stmt)).scalars().all()

        video_conditions = or_(
            Video.title.like(like),
            Video.description.like(like),
            VideoAnalysis.transcript.like(like),
            VideoAnalysis.summary.like(like),
            cast(VideoAnalysis.key_points, Text).like(like),
        )
        enrolled_ids_subquery = select(Enrollment.course_id).where(
            Enrollment.student_id == actor.id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]),
        )
        course_video_visibility = (
            Video.owner_id == actor.id
            if actor.role != UserRole.STUDENT
            else or_(
                Video.owner_id == actor.id,
                Course.id.in_(enrolled_ids_subquery),
                Course.status == CourseStatus.PUBLISHED,
            )
        )
        video_stmt = (
            select(Video)
            .outerjoin(VideoAnalysis, VideoAnalysis.video_id == Video.id)
            .outerjoin(CourseLesson, Video.lesson_id == CourseLesson.id)
            .outerjoin(CourseModule, CourseLesson.module_id == CourseModule.id)
            .outerjoin(Course, CourseModule.course_id == Course.id)
            .where(course_video_visibility, video_conditions)
            .order_by(Video.updated_at.desc())
            .limit(limit)
        )
        videos = (await self.db.execute(video_stmt)).scalars().unique().all()

        note_stmt = select(Note).where(
            Note.user_id == actor.id,
            or_(Note.title.like(like), Note.content.like(like)),
        ).order_by(Note.updated_at.desc()).limit(limit)
        notes = (await self.db.execute(note_stmt)).scalars().all()

        teacher_stmt = (
            select(User, UserProfile, TeacherYouTubeChannel)
            .join(UserProfile, UserProfile.user_id == User.id)
            .outerjoin(TeacherYouTubeChannel, TeacherYouTubeChannel.teacher_id == User.id)
            .where(
                User.role == UserRole.TEACHER,
                User.status == UserStatus.ACTIVE,
                or_(UserProfile.full_name.like(like), UserProfile.display_name.like(like), UserProfile.bio.like(like), TeacherYouTubeChannel.channel_title.like(like)),
            )
            .limit(limit)
        )
        teacher_rows = (await self.db.execute(teacher_stmt)).all()

        return {
            "courses": [
                {"id": str(c.id), "kind": "course", "title": c.title, "description": c.short_description or c.description, "thumbnail_url": c.thumbnail_url, "url": f"/student/courses/{c.id}"}
                for c in courses
            ],
            "videos": [
                {"id": str(v.id), "kind": "video", "title": v.title or f"Video #{v.id}", "description": v.description, "thumbnail_url": v.thumbnail_url, "url": f"/student/videos/{v.id}", "source": v.source.value if hasattr(v.source, 'value') else str(v.source)}
                for v in videos
            ],
            "notes": [
                {"id": str(n.id), "kind": "note", "title": n.title or "Untitled note", "description": n.content[:240] if n.content else None, "url": f"/student/notes?note={n.id}"}
                for n in notes
            ],
            "teachers": [
                {
                    "id": str(user.id),
                    "kind": "teacher",
                    "title": profile.display_name or profile.full_name,
                    "description": channel.channel_title if channel else profile.bio,
                    "thumbnail_url": channel.thumbnail_url if channel else profile.avatar_url,
                    "url": f"/student/teachers/{user.id}",
                    "channel_id": channel.channel_id if channel else None,
                }
                for user, profile, channel in teacher_rows
            ],
        }

    async def search(self, actor: User, query: str, include_youtube: bool = True) -> dict:
        result = await self.search_internal(actor, query)
        result["youtube_videos"] = []
        result["youtube_channels"] = []
        result["youtube_configured"] = bool(__import__("app.config.settings", fromlist=["settings"]).settings.YOUTUBE_API_KEY)
        if include_youtube and result["youtube_configured"]:
            # YouTube is an optional discovery source. A quota/network/API-key
            # failure must never hide local LearnMate courses from search.
            try:
                yt = YouTubeSearchService()
                result["youtube_videos"] = [
                    {
                        "id": x["video_id"],
                        "kind": "youtube_video",
                        "title": x["title"],
                        "description": x.get("description"),
                        "thumbnail_url": x.get("thumbnail_url"),
                        "url": f"https://www.youtube.com/watch?v={x['video_id']}",
                        "source": "YOUTUBE",
                        "channel_id": x.get("channel_id"),
                        "channel_title": x.get("channel_title"),
                        "published_at": x.get("published_at"),
                    }
                    for x in await yt.search_videos(query, max_results=10)
                ]
                result["youtube_channels"] = [
                    {
                        "id": x["channel_id"],
                        "kind": "youtube_channel",
                        "title": x["title"],
                        "description": x.get("description"),
                        "thumbnail_url": x.get("thumbnail_url"),
                        "url": f"/student/search/channel/{x['channel_id']}",
                        "channel_id": x["channel_id"],
                    }
                    for x in await yt.search_channels(query, max_results=8)
                ]
            except Exception as exc:  # noqa: BLE001
                # Keep local courses/videos/notes/teachers available. Log the
                # optional provider failure instead of turning search into 500.
                import logging
                logging.getLogger("learnmate.search").warning(
                    "youtube_search_unavailable: %s", exc
                )
                result["youtube_videos"] = []
                result["youtube_channels"] = []
        return result
