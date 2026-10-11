from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import AuthorizationError, NotFoundError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.models.teacher_youtube_channel import TeacherYouTubeChannel
from app.models.user import UserRole
from app.schemas.search import TeacherChannelLinkIn, YouTubeChannelOut
from app.services.youtube_search_service import YouTubeSearchService

router = APIRouter(prefix="/teacher/youtube-channel", tags=["teacher:youtube"])


def require_teacher(user):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise AuthorizationError("Only teachers can manage a YouTube channel link")


@router.get("", response_model=YouTubeChannelOut | None)
async def get_linked_channel(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    require_teacher(user)
    row = (await db.execute(select(TeacherYouTubeChannel).where(TeacherYouTubeChannel.teacher_id == user.id, TeacherYouTubeChannel.is_active == True))).scalar_one_or_none()
    if not row:
        return None
    return YouTubeChannelOut(
        channel_id=row.channel_id,
        channel_url=row.channel_url,
        title=row.channel_title or "YouTube Channel",
        description=row.description,
        thumbnail_url=row.thumbnail_url,
        subscriber_count=row.subscriber_count,
        video_count=row.video_count,
        view_count=row.view_count,
        uploads_playlist_id=row.uploads_playlist_id,
        linked_teacher_id=row.teacher_id,
    )


@router.put("", response_model=YouTubeChannelOut)
async def link_channel(
    payload: TeacherChannelLinkIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    require_teacher(user)
    yt = YouTubeSearchService()
    channel = await yt.resolve_channel(payload.channel)

    existing_channel = (await db.execute(select(TeacherYouTubeChannel).where(TeacherYouTubeChannel.teacher_id == user.id))).scalar_one_or_none()
    if existing_channel:
        row = existing_channel
    else:
        row = TeacherYouTubeChannel(teacher_id=user.id)
        db.add(row)

    row.channel_id = channel["channel_id"]
    row.channel_url = channel["channel_url"]
    row.channel_title = channel.get("title")
    row.description = channel.get("description")
    row.thumbnail_url = channel.get("thumbnail_url")
    row.uploads_playlist_id = channel.get("uploads_playlist_id")
    row.subscriber_count = channel.get("subscriber_count")
    row.video_count = channel.get("video_count")
    row.view_count = channel.get("view_count")
    row.is_active = True
    row.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    return YouTubeChannelOut(
        channel_id=row.channel_id,
        channel_url=row.channel_url,
        title=row.channel_title or "YouTube Channel",
        description=row.description,
        thumbnail_url=row.thumbnail_url,
        subscriber_count=row.subscriber_count,
        video_count=row.video_count,
        view_count=row.view_count,
        uploads_playlist_id=row.uploads_playlist_id,
        linked_teacher_id=row.teacher_id,
    )


@router.delete("", status_code=204)
async def unlink_channel(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    require_teacher(user)
    row = (await db.execute(select(TeacherYouTubeChannel).where(TeacherYouTubeChannel.teacher_id == user.id))).scalar_one_or_none()
    if row:
        row.is_active = False
        await db.commit()
