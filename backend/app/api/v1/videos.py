from typing import Annotated

from fastapi import APIRouter, Depends, File as FastFile, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.exceptions import ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.video import (
    VideoCreateFromYouTube,
    VideoCreateResponse,
    VideoAnalysisOut,
    VideoDetailOut,
    VideoListOut,
    VideoOut,
    VideoStateOut,
    VideoStateUpdate,
    VideoStatusOut,
    VideoUpdate,
)
from app.services.video_service import VideoService
from app.workers.tasks.video_tasks import fetch_video_transcript, process_video

router = APIRouter(prefix="/videos", tags=["videos"])


def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if total else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


def _state_out(state, video_id: int, fallback_duration: int | None = None) -> VideoStateOut:
    if not state:
        return VideoStateOut(video_id=video_id, duration_seconds=fallback_duration)
    return VideoStateOut(
        video_id=state.video_id,
        saved_for_later=state.saved_for_later,
        last_position_seconds=state.last_position_seconds,
        watched_seconds=state.watched_seconds,
        duration_seconds=state.duration_seconds or fallback_duration,
        progress_percent=state.progress_percent,
        is_completed=state.is_completed,
    )


@router.get("", response_model=VideoListOut)
async def list_videos(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
):
    rows, total = await VideoService(db).list_mine(user, page=page, page_size=page_size)
    return VideoListOut(
        items=[VideoOut.model_validate(row) for row in rows],
        **_paginate(page, page_size, total),
    )


@router.get("/saved", response_model=VideoListOut)
async def list_saved_videos(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
):
    rows, total = await VideoService(db).list_saved(user, page=page, page_size=page_size)
    return VideoListOut(
        items=[VideoOut.model_validate(row) for row in rows],
        **_paginate(page, page_size, total),
    )


@router.post(
    "",
    response_model=VideoCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN))],
)
async def create_video(
    payload: VideoCreateFromYouTube,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = VideoService(db)
    video, should_process = await svc.create_from_youtube(
        user, url=payload.url, lesson_id=payload.lesson_id
    )
    task_id = process_video.delay(video.id).id if should_process else ""
    if should_process and video.source.value == "YOUTUBE":
        fetch_video_transcript.delay(video.id)
    return VideoCreateResponse(video=VideoOut.model_validate(video), task_id=task_id)


@router.post(
    "/upload",
    response_model=VideoCreateResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def upload_video(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = FastFile(...),
    lesson_id: int | None = Form(default=None),
):
    if not file.filename:
        raise ValidationError("Filename is required")
    data = await file.read()
    if len(data) > settings.MAX_VIDEO_UPLOAD_BYTES:
        raise ValidationError("Video exceeds the configured upload limit")

    video = await VideoService(db).create_from_upload(
        user,
        filename=file.filename,
        data=data,
        mime_type=file.content_type,
        lesson_id=lesson_id,
    )
    task = process_video.delay(video.id)
    if video.source.value == "YOUTUBE":
        fetch_video_transcript.delay(video.id)
    return VideoCreateResponse(video=VideoOut.model_validate(video), task_id=task.id)


@router.patch(
    "/{video_id}",
    response_model=VideoOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def update_video(
    video_id: int,
    payload: VideoUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    video = await VideoService(db).update_video(
        user, video_id, payload.model_dump(exclude_unset=True)
    )
    return VideoOut.model_validate(video)


@router.get("/{video_id}", response_model=VideoDetailOut)
async def get_video(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    detail = await VideoService(db).get_detail(user, video_id)
    video = detail["video"]
    analysis = detail.get("analysis")
    state = detail.get("state")

    return VideoDetailOut(
        **VideoOut.model_validate(video).model_dump(),
        transcript=analysis.transcript if analysis else None,
        analysis=VideoAnalysisOut.model_validate(analysis) if analysis else None,
        state=_state_out(state, video.id, video.duration_seconds),
    )


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await VideoService(db).delete_video(user, video_id)


@router.get("/{video_id}/status", response_model=VideoStatusOut)
async def get_video_status(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return VideoStatusOut(**await VideoService(db).get_status(user, video_id))


@router.get("/{video_id}/state", response_model=VideoStateOut)
async def get_video_state(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = VideoService(db)
    video = await svc.get_for_viewer(user, video_id)
    state = await svc.get_state(user, video_id)
    return _state_out(state, video_id, video.duration_seconds)


@router.patch("/{video_id}/state", response_model=VideoStateOut)
async def update_video_state(
    video_id: int,
    payload: VideoStateUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    state = await VideoService(db).update_state(
        user, video_id, **payload.model_dump(exclude_unset=True)
    )
    return _state_out(state, video_id, state.duration_seconds)


@router.post("/{video_id}/save", response_model=VideoStateOut)
async def save_video(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    state = await VideoService(db).update_state(user, video_id, saved_for_later=True)
    return _state_out(state, video_id, state.duration_seconds)


@router.delete("/{video_id}/save", response_model=VideoStateOut)
async def unsave_video(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    state = await VideoService(db).update_state(user, video_id, saved_for_later=False)
    return _state_out(state, video_id, state.duration_seconds)


@router.post("/{video_id}/transcript/retry", response_model=VideoOut)
async def retry_video_transcript(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    video = await VideoService(db).get_for_viewer(user, video_id)
    if video.source.value != "YOUTUBE":
        raise ValidationError("Transcript retry is available for YouTube videos only")
    fetch_video_transcript.delay(video.id)
    return VideoOut.model_validate(video)


@router.post("/{video_id}/reprocess", response_model=VideoCreateResponse)
async def reprocess_video(
    video_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = VideoService(db)
    video = await svc.get_for_viewer(user, video_id)
    task = process_video.delay(video.id)
    if video.source.value == "YOUTUBE":
        fetch_video_transcript.delay(video.id)
    return VideoCreateResponse(video=VideoOut.model_validate(video), task_id=task.id)
