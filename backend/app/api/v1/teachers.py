from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.models.course import Course, CourseStatus
from app.models.teacher_youtube_channel import TeacherYouTubeChannel
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.schemas.teacher import TeacherPublicProfileOut
from app.schemas.course import CourseListItem
from app.schemas.search import YouTubeChannelOut

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/{teacher_id}", response_model=TeacherPublicProfileOut)
async def get_public_teacher_profile(
    teacher_id: int,
    _viewer: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(User, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(
            User.id == teacher_id,
            User.role == UserRole.TEACHER,
            User.status == UserStatus.ACTIVE,
        )
    )
    row = result.first()
    if not row:
        raise NotFoundError("Teacher profile not found")

    user, profile = row

    channel = (
        await db.execute(
            select(TeacherYouTubeChannel).where(
                TeacherYouTubeChannel.teacher_id == teacher_id,
                TeacherYouTubeChannel.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()

    courses = (
        await db.execute(
            select(Course)
            .options(selectinload(Course.teacher).selectinload(User.profile))
            .where(
                Course.teacher_id == teacher_id,
                Course.status == CourseStatus.PUBLISHED,
            )
            .order_by(Course.published_at.desc(), Course.created_at.desc())
        )
    ).scalars().all()

    youtube = None
    if channel:
        youtube = YouTubeChannelOut(
            channel_id=channel.channel_id,
            channel_url=channel.channel_url,
            title=channel.channel_title or "YouTube Channel",
            description=channel.description,
            thumbnail_url=channel.thumbnail_url,
            subscriber_count=channel.subscriber_count,
            video_count=channel.video_count,
            view_count=channel.view_count,
            uploads_playlist_id=channel.uploads_playlist_id,
            linked_teacher_id=channel.teacher_id,
        )

    fallback_name = (user.email.split("@", 1)[0] or "Teacher").replace(".", " ").strip().title()
    return TeacherPublicProfileOut(
        id=user.id,
        full_name=profile.full_name if profile else fallback_name,
        display_name=profile.display_name if profile else None,
        bio=profile.bio if profile else None,
        avatar_url=profile.avatar_url if profile else None,
        organization=profile.organization if profile else None,
        joined_at=user.created_at,
        youtube_channel=youtube,
        courses=[CourseListItem.model_validate(course) for course in courses],
    )
