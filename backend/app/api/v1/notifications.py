from typing import Annotated
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from app.models.course import Course, Enrollment, EnrollmentStatus
from app.models.user import UserRole

from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.notification import (
    MessageResponse,
    NotificationListOut,
    NotificationOut,
    UnreadCountOut,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    unread_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
):
    rows, total = await NotificationService(db).list_for_user(
        user, unread_only=unread_only, page=page, page_size=page_size
    )
    return NotificationListOut(
        items=[NotificationOut.model_validate(n) for n in rows],
        **_paginate(page, page_size, total),
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return UnreadCountOut(unread=await NotificationService(db).unread_count(user))


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return NotificationOut.model_validate(
        await NotificationService(db).mark_read(user, notification_id)
    )


@router.post("/read-all", response_model=UnreadCountOut)
async def mark_all_read(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await NotificationService(db).mark_all_read(user)
    return UnreadCountOut(unread=0)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await NotificationService(db).delete(user, notification_id)

class CourseAnnouncementIn(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=3, max_length=300)
    body: str = Field(min_length=1, max_length=10000)
    category: str = Field(default="course_update", pattern="^(course_update|lesson|deadline|important)$")


@router.post("/course-announcements", status_code=status.HTTP_201_CREATED)
async def create_course_announcement(
    payload: CourseAnnouncementIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Only teachers can send course announcements")
    course = (await db.execute(select(Course).where(Course.id == payload.course_id))).scalar_one_or_none()
    if not course or (user.role == UserRole.TEACHER and course.teacher_id != user.id):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Course not found")
    enrollments = (await db.execute(
        select(Enrollment).where(Enrollment.course_id == course.id, Enrollment.status != EnrollmentStatus.DROPPED)
    )).scalars().all()
    if not enrollments:
        return {"course_id": course.id, "course_title": course.title, "recipient_count": 0, "message": "No enrolled students to notify."}
    svc = NotificationService(db)
    for enrollment in enrollments:
        await svc.notify(
            user_id=enrollment.student_id, type="course_announcement", title=payload.title,
            body=payload.body, link_url=f"/student/courses/{course.id}",
            metadata={"course_id": course.id, "course_title": course.title, "category": payload.category, "teacher_id": user.id},
        )
    await db.commit()
    return {"course_id": course.id, "course_title": course.title, "recipient_count": len(enrollments), "message": "Announcement sent."}
