from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError, NotFoundError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.models.teacher_youtube_channel import TeacherYouTubeChannel
from app.schemas.search import (
    SearchResponse,
    YouTubeChannelDetail,
    YouTubeChannelOut,
    YouTubeChannelVideo,
)
from app.services.search_service import SearchService
from app.services.youtube_search_service import YouTubeSearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search_all(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(min_length=2, max_length=100),
):
    data = await SearchService(db).search(user, q)
    return SearchResponse(query=q, **data)


@router.get("/youtube/channels/{channel_id}", response_model=YouTubeChannelDetail)
async def get_youtube_channel(
    channel_id: str,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    yt = YouTubeSearchService()
    channel = await yt.get_channel(channel_id)
    if not channel:
        raise NotFoundError("YouTube channel not found")

    # Channel metadata should still render when the upload playlist request is
    # temporarily unavailable. This prevents a single downstream failure from
    # blanking the whole channel page.
    videos = []
    try:
        videos = await yt.get_channel_videos(channel_id, max_results=20, channel=channel)
    except AppError:
        videos = []

    linked = (
        await db.execute(
            select(TeacherYouTubeChannel).where(
                TeacherYouTubeChannel.channel_id == channel_id,
                TeacherYouTubeChannel.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    channel["linked_teacher_id"] = linked.teacher_id if linked else None

    return YouTubeChannelDetail(
        channel=YouTubeChannelOut(**channel),
        videos=[YouTubeChannelVideo(**video) for video in videos],
    )
