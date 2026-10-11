from __future__ import annotations

from typing import Annotated, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.progress import (
    CourseProgressOut,
    LessonCompleteIn,
    ProgressOut,
    VideoProgressIn,
    VideoProgressOut,
)
from app.services.progress_service import ProgressService

router = APIRouter(prefix="/progress", tags=["progress"])


@router.post(
    "/lessons/{lesson_id}/complete",
    response_model=CourseProgressOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def mark_lesson_complete(
    lesson_id: int,
    payload: LessonCompleteIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = ProgressService(db)
    await svc.mark_lesson_complete(
        user, lesson_id,
        video_id=payload.video_id,
        last_position_seconds=payload.last_position_seconds,
        duration_seconds=payload.duration_seconds,
    )
    lesson = await svc.lessons.get_by_id(lesson_id)
    module = await svc.modules.get_by_id(lesson.module_id)
    return CourseProgressOut(**await svc.course_progress(user, module.course_id))


@router.post(
    "/videos/{video_id}",
    response_model=VideoProgressOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def update_video_progress(
    video_id: int,
    payload: VideoProgressIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return VideoProgressOut(
        **await ProgressService(db).update_video_progress(
            user, video_id,
            last_position_seconds=payload.last_position_seconds,
            duration_seconds=payload.duration_seconds,
            completed=payload.completed,
        )
    )


@router.get(
    "/courses/{course_id}",
    response_model=CourseProgressOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def course_progress(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return CourseProgressOut(
        **await ProgressService(db).course_progress(user, course_id)
    )


@router.get("/lessons/{lesson_id}", response_model=Optional[ProgressOut])
async def lesson_progress(
    lesson_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = await ProgressService(db).lesson_progress(user, lesson_id)
    return ProgressOut.model_validate(row) if row else None