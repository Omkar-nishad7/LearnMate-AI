from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.config.settings import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.assignment import Assignment
from app.models.audit import AIUsageLog, AuditLog
from app.models.course import Course, CourseLesson, CourseModule, CourseStatus, Enrollment, EnrollmentStatus
from app.models.file import File
from app.models.note import Note
from app.models.notification import Notification
from app.models.quiz import Quiz
from app.models.user import RefreshToken, User, UserProfile, UserRole, UserStatus
from app.models.video import Video, VideoAnalysis
from app.services.audit_service import AuditService
from app.services.file_service import FileService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(UserRole.ADMIN))])


class UserAdminUpdate(BaseModel):
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    is_email_verified: Optional[bool] = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class CourseStatusUpdate(BaseModel):
    status: CourseStatus


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    body: str = Field(min_length=1, max_length=10000)
    audience: Literal["ALL", "STUDENT", "TEACHER", "USER"] = "ALL"
    target_user_id: Optional[int] = Field(default=None, gt=0)
    link_url: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_audience(self):
        if self.audience == "USER" and self.target_user_id is None:
            raise ValueError("target_user_id is required when audience is USER")
        if self.audience != "USER" and self.target_user_id is not None:
            raise ValueError("target_user_id is only valid when audience is USER")
        return self


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _day_start() -> datetime:
    now = _utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _name(user: Optional[User]) -> Optional[str]:
    if not user:
        return None
    profile = getattr(user, "profile", None)
    return (profile.display_name or profile.full_name) if profile else user.email


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": _name(user),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "status": user.status.value if hasattr(user.status, "value") else str(user.status),
        "is_email_verified": user.is_email_verified,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "avatar_url": user.profile.avatar_url if user.profile else None,
    }


@router.get("/overview")
async def admin_overview(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregated platform metrics backed by existing application tables."""
    active_users = [User.deleted_at.is_(None), User.status != UserStatus.DELETED]
    user_groups = (await db.execute(
        select(User.role, User.status, func.count(User.id))
        .where(*active_users).group_by(User.role, User.status)
    )).all()
    user_counts = {(role_value, status_value): int(count or 0) for role_value, status_value, count in user_groups}
    total_users = sum(user_counts.values())
    total_students = sum(count for (role_value, _), count in user_counts.items() if role_value == UserRole.STUDENT)
    total_teachers = sum(count for (role_value, _), count in user_counts.items() if role_value == UserRole.TEACHER)
    total_admins = sum(count for (role_value, _), count in user_counts.items() if role_value == UserRole.ADMIN)
    active_students = user_counts.get((UserRole.STUDENT, UserStatus.ACTIVE), 0)
    pending_teachers = user_counts.get((UserRole.TEACHER, UserStatus.PENDING), 0)

    course_groups = (await db.execute(
        select(Course.status, func.count(Course.id)).group_by(Course.status)
    )).all()
    course_counts = {status_value: int(count or 0) for status_value, count in course_groups}
    total_courses = sum(course_counts.values())
    published_courses = course_counts.get(CourseStatus.PUBLISHED, 0)
    draft_courses = course_counts.get(CourseStatus.DRAFT, 0)
    archived_courses = course_counts.get(CourseStatus.ARCHIVED, 0)
    enrollments = int(await db.scalar(
        select(func.count(Enrollment.id)).where(Enrollment.status != EnrollmentStatus.DROPPED)
    ) or 0)
    today_start = _day_start()
    usage_totals = (await db.execute(select(
        func.coalesce(func.sum(AIUsageLog.request_count), 0).label("all_requests"),
        func.coalesce(func.sum(case((AIUsageLog.created_at >= today_start, AIUsageLog.request_count), else_=0)), 0).label("today_requests"),
        func.coalesce(func.sum(case((AIUsageLog.created_at >= today_start, AIUsageLog.tokens_used), else_=0)), 0).label("today_tokens"),
        func.coalesce(func.sum(case(((AIUsageLog.created_at >= today_start) & (AIUsageLog.status != "SUCCESS"), 1), else_=0)), 0).label("today_errors"),
    ))).one()
    total_ai_requests = int(usage_totals.all_requests or 0)
    today_ai_requests = int(usage_totals.today_requests or 0)
    today_tokens = int(usage_totals.today_tokens or 0)
    failed_ai_today = int(usage_totals.today_errors or 0)
    storage_bytes = int(await db.scalar(select(func.coalesce(func.sum(File.size_bytes), 0))) or 0)

    recent_users_result = await db.execute(
        select(User).options(joinedload(User.profile))
        .where(User.deleted_at.is_(None), User.status != UserStatus.DELETED)
        .order_by(User.created_at.desc()).limit(6)
    )
    recent_courses_result = await db.execute(
        select(Course).options(joinedload(Course.teacher).joinedload(User.profile))
        .order_by(Course.created_at.desc()).limit(6)
    )
    recent_ai_result = await db.execute(
        select(AIUsageLog, User, UserProfile)
        .join(User, User.id == AIUsageLog.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(AIUsageLog.created_at.desc()).limit(8)
    )
    recent_audit_result = await db.execute(
        select(AuditLog, User, UserProfile)
        .outerjoin(User, User.id == AuditLog.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .order_by(AuditLog.created_at.desc()).limit(8)
    )
    recent_users = [_user_out(row) for row in recent_users_result.scalars().all()]
    recent_courses = [
        {
            "id": c.id, "title": c.title, "category": c.category,
            "status": c.status.value, "created_at": c.created_at,
            "teacher_name": _name(c.teacher), "teacher_email": c.teacher.email if c.teacher else None,
            "thumbnail_url": c.thumbnail_url,
        }
        for c in recent_courses_result.scalars().all()
    ]
    recent_ai = []
    for log, ai_user, profile in recent_ai_result.all():
        recent_ai.append({
            "id": log.id, "feature": log.feature, "status": log.status,
            "request_count": log.request_count, "tokens_used": log.tokens_used,
            "error_message": log.error_message, "created_at": log.created_at,
            "user_id": ai_user.id, "user_name": (profile.display_name or profile.full_name) if profile else ai_user.email,
            "user_email": ai_user.email,
        })
    recent_activity = []
    for log, actor, profile in recent_audit_result.all():
        recent_activity.append({
            "id": log.id, "action": log.action, "entity_type": log.entity_type,
            "entity_id": log.entity_id, "created_at": log.created_at,
            "user_id": actor.id if actor else None,
            "user_name": (profile.display_name or profile.full_name) if profile else (actor.email if actor else "System"),
            "ip_address": log.ip_address,
        })

    return {
        "metrics": {
            "total_users": total_users, "active_students": active_students,
            "students": total_students, "teachers": total_teachers, "admins": total_admins,
            "pending_teacher_accounts": pending_teachers,
            "courses": total_courses, "published_courses": published_courses,
            "draft_courses": draft_courses, "archived_courses": archived_courses,
            "enrollments": enrollments, "ai_requests_today": today_ai_requests,
            "ai_requests_total": total_ai_requests, "ai_tokens_today": today_tokens,
            "ai_errors_today": failed_ai_today, "storage_bytes": storage_bytes,
        },
        "recent_users": recent_users,
        "recent_courses": recent_courses,
        "recent_ai_usage": recent_ai,
        "recent_activity": recent_activity,
        "generated_at": _utcnow(),
    }


@router.get("/users")
async def admin_list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None, max_length=150),
    role: Optional[UserRole] = None,
    status_filter: Optional[UserStatus] = Query(default=None, alias="status"),
    verified: Optional[bool] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filters = [User.deleted_at.is_(None), User.status != UserStatus.DELETED]
    if role:
        filters.append(User.role == role)
    if status_filter:
        filters.append(User.status == status_filter)
    if verified is not None:
        filters.append(User.is_email_verified.is_(verified))
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(User.email.ilike(term), UserProfile.full_name.ilike(term), UserProfile.display_name.ilike(term)))
    total = int(await db.scalar(select(func.count(User.id)).outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)) or 0)
    result = await db.execute(
        select(User).options(joinedload(User.profile))
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(*filters).order_by(User.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    items = [_user_out(u) for u in result.unique().scalars().all()]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: UserAdminUpdate,
    request: Request,
    admin: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    target = (await db.execute(select(User).options(joinedload(User.profile)).where(User.id == user_id, User.deleted_at.is_(None))).unique()).scalar_one_or_none()
    if not target or target.status == UserStatus.DELETED:
        raise NotFoundError("User not found")
    changes = payload.model_dump(exclude_unset=True)
    if target.id == admin.id and (changes.get("status") in (UserStatus.SUSPENDED, UserStatus.DELETED) or changes.get("role") not in (None, UserRole.ADMIN)):
        raise ValidationError("You cannot suspend, delete, or demote your own admin account")

    loses_admin_access = target.role == UserRole.ADMIN and (
        changes.get("role") not in (None, UserRole.ADMIN)
        or changes.get("status") in (UserStatus.SUSPENDED, UserStatus.DELETED)
    )
    if loses_admin_access:
        admins_remaining = int(await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.status == UserStatus.ACTIVE, User.deleted_at.is_(None))) or 0)
        if admins_remaining <= 1:
            raise ValidationError("The last active admin cannot be demoted or suspended")

    before = {"role": target.role.value, "status": target.status.value, "is_email_verified": target.is_email_verified}
    for field, value in changes.items():
        if field == "role" and value is not None:
            target.role = value
        elif field == "status" and value is not None:
            target.status = value
            target.deleted_at = _utcnow() if value == UserStatus.DELETED else None
        elif field == "is_email_verified" and value is not None:
            target.is_email_verified = value
            if value:
                target.email_verification_token = None

    if target.status in (UserStatus.SUSPENDED, UserStatus.DELETED):
        tokens = (await db.execute(select(RefreshToken).where(RefreshToken.user_id == target.id, RefreshToken.revoked.is_(False)))).scalars().all()
        now = _utcnow()
        for token in tokens:
            token.revoked = True
            token.revoked_at = now
    await AuditService(db).log(
        action="admin.user_updated", user_id=admin.id, entity_type="user", entity_id=target.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"target_user_id": target.id, "before": before, "after": {"role": target.role.value, "status": target.status.value, "is_email_verified": target.is_email_verified}},
    )
    await db.commit()
    await db.refresh(target)
    refreshed = (await db.execute(select(User).options(joinedload(User.profile)).where(User.id == target.id))).unique().scalar_one()
    return _user_out(refreshed)


@router.get("/teachers/pending")
async def admin_pending_teachers(db: Annotated[AsyncSession, Depends(get_db)]):
    """Return pending teacher accounts. The current schema tracks account status, not a separate application form."""
    result = await db.execute(
        select(User).options(joinedload(User.profile))
        .where(User.role == UserRole.TEACHER, User.status == UserStatus.PENDING, User.deleted_at.is_(None))
        .order_by(User.created_at.asc()).limit(200)
    )
    return {"items": [_user_out(u) for u in result.unique().scalars().all()]}


@router.get("/courses")
async def admin_list_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None, max_length=150),
    status_filter: Optional[CourseStatus] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filters = []
    if status_filter:
        filters.append(Course.status == status_filter)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Course.title.ilike(term), Course.category.ilike(term), User.email.ilike(term), UserProfile.full_name.ilike(term)))
    total = int(await db.scalar(select(func.count(Course.id)).join(User, Course.teacher_id == User.id).outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)) or 0)
    result = await db.execute(
        select(Course).options(joinedload(Course.teacher).joinedload(User.profile))
        .join(User, Course.teacher_id == User.id).outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(*filters).order_by(Course.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    courses = result.unique().scalars().all()
    ids = [c.id for c in courses]
    stats: dict[int, dict] = {}
    if ids:
        rows = (await db.execute(
            select(Enrollment.course_id, func.count(Enrollment.id), func.avg(Enrollment.progress_percent))
            .where(Enrollment.course_id.in_(ids), Enrollment.status != EnrollmentStatus.DROPPED)
            .group_by(Enrollment.course_id)
        )).all()
        stats = {int(cid): {"enrollments": int(count or 0), "avg_progress_percent": round(float(avg or 0), 1)} for cid, count, avg in rows}
    items = []
    for c in courses:
        stat = stats.get(c.id, {"enrollments": 0, "avg_progress_percent": 0})
        items.append({
            "id": c.id, "title": c.title, "slug": c.slug, "category": c.category,
            "status": c.status.value, "thumbnail_url": c.thumbnail_url,
            "created_at": c.created_at, "teacher_id": c.teacher_id,
            "teacher_name": _name(c.teacher), "teacher_email": c.teacher.email if c.teacher else None,
            "enrollments": stat["enrollments"], "avg_progress_percent": stat["avg_progress_percent"],
            "is_free": c.is_free,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}


@router.patch("/courses/{course_id}/status")
async def admin_set_course_status(
    course_id: int,
    payload: CourseStatusUpdate,
    request: Request,
    admin: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise NotFoundError("Course not found")
    old_status = course.status.value
    if payload.status == CourseStatus.PUBLISHED:
        lesson_count = int(await db.scalar(
            select(func.count(CourseLesson.id)).join(CourseModule, CourseLesson.module_id == CourseModule.id)
            .where(CourseModule.course_id == course.id)
        ) or 0)
        if lesson_count < 1:
            raise ValidationError("Cannot publish a course until it has at least one lesson")
        course.published_at = _utcnow()
        course.archived_at = None
    elif payload.status == CourseStatus.ARCHIVED:
        course.archived_at = _utcnow()
    else:
        course.archived_at = None
    course.status = payload.status
    await AuditService(db).log(
        action="admin.course_status_updated", user_id=admin.id, entity_type="course", entity_id=course.id,
        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
        metadata={"before": old_status, "after": payload.status.value, "title": course.title},
    )
    await db.commit()
    return {"id": course.id, "status": course.status.value, "message": "Course status updated."}


@router.get("/ai-usage")
async def admin_ai_usage(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    feature: Optional[str] = Query(default=None, max_length=50),
    status_filter: Optional[str] = Query(default=None, alias="status", max_length=20),
):
    today = _day_start()
    filters = []
    if feature:
        filters.append(AIUsageLog.feature == feature)
    if status_filter:
        filters.append(AIUsageLog.status == status_filter)
    total = int(await db.scalar(select(func.count(AIUsageLog.id)).where(*filters)) or 0)
    today_requests = int(await db.scalar(select(func.coalesce(func.sum(AIUsageLog.request_count), 0)).where(AIUsageLog.created_at >= today)) or 0)
    today_tokens = int(await db.scalar(select(func.coalesce(func.sum(AIUsageLog.tokens_used), 0)).where(AIUsageLog.created_at >= today)) or 0)
    errors = int(await db.scalar(select(func.count(AIUsageLog.id)).where(AIUsageLog.created_at >= today, AIUsageLog.status != "SUCCESS")) or 0)
    feature_rows = (await db.execute(select(AIUsageLog.feature, func.sum(AIUsageLog.request_count)).group_by(AIUsageLog.feature))).all()
    feature_totals = [{"feature": feature_name, "requests": int(count or 0)} for feature_name, count in feature_rows]
    result = await db.execute(
        select(AIUsageLog, User, UserProfile).join(User, User.id == AIUsageLog.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)
        .order_by(AIUsageLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    items = []
    for log, ai_user, profile in result.all():
        items.append({
            "id": log.id, "user_id": ai_user.id, "user_name": (profile.display_name or profile.full_name) if profile else ai_user.email,
            "user_email": ai_user.email, "feature": log.feature, "status": log.status,
            "request_count": log.request_count, "tokens_used": log.tokens_used,
            "error_message": log.error_message, "created_at": log.created_at,
        })
    return {"metrics": {"requests_today": today_requests, "tokens_today": today_tokens, "errors_today": errors}, "feature_totals": feature_totals, "items": items, "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}


@router.get("/analytics")
async def admin_analytics(db: Annotated[AsyncSession, Depends(get_db)], days: int = Query(default=30, ge=7, le=90)):
    today = _utcnow().date()
    start_dt = datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), tzinfo=timezone.utc)
    user_dates = (await db.execute(select(User.created_at).where(User.created_at >= start_dt, User.deleted_at.is_(None), User.status != UserStatus.DELETED))).scalars().all()
    course_dates = (await db.execute(select(Course.created_at).where(Course.created_at >= start_dt))).scalars().all()
    usage_rows = (await db.execute(select(AIUsageLog.created_at, AIUsageLog.request_count).where(AIUsageLog.created_at >= start_dt))).all()
    trend = {}
    for offset in range(days):
        date_key = (today - timedelta(days=days - offset - 1)).isoformat()
        trend[date_key] = {"date": date_key, "new_users": 0, "new_courses": 0, "ai_requests": 0}
    for value in user_dates:
        if value:
            key = value.date().isoformat()
            if key in trend: trend[key]["new_users"] += 1
    for value in course_dates:
        if value:
            key = value.date().isoformat()
            if key in trend: trend[key]["new_courses"] += 1
    for value, count in usage_rows:
        if value:
            key = value.date().isoformat()
            if key in trend: trend[key]["ai_requests"] += int(count or 0)
    completion = float(await db.scalar(select(func.avg(Enrollment.progress_percent)).where(Enrollment.status != EnrollmentStatus.DROPPED)) or 0)
    return {"days": days, "trend": list(trend.values()), "average_course_progress": round(completion, 1)}


@router.get("/content")
async def admin_content_overview(db: Annotated[AsyncSession, Depends(get_db)]):
    metrics = {
        "videos": int(await db.scalar(select(func.count(Video.id))) or 0),
        "video_analyses": int(await db.scalar(select(func.count(VideoAnalysis.id))) or 0),
        "notes": int(await db.scalar(select(func.count(Note.id))) or 0),
        "quizzes": int(await db.scalar(select(func.count(Quiz.id))) or 0),
        "assignments": int(await db.scalar(select(func.count(Assignment.id))) or 0),
        "files": int(await db.scalar(select(func.count(File.id))) or 0),
        "storage_bytes": int(await db.scalar(select(func.coalesce(func.sum(File.size_bytes), 0))) or 0),
        "video_processing_failed": int(await db.scalar(select(func.count(Video.id)).where(Video.status == "FAILED")) or 0),
    }
    videos = (await db.execute(select(Video).order_by(Video.created_at.desc()).limit(8))).scalars().all()
    return {"metrics": metrics, "recent_videos": [{"id": v.id, "title": v.title or "Untitled video", "source": v.source.value, "status": v.status.value, "created_at": v.created_at, "owner_id": v.owner_id} for v in videos]}


@router.get("/files")
async def admin_list_files(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None, max_length=150),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    filters = []
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(File.original_name.ilike(term), User.email.ilike(term), UserProfile.full_name.ilike(term)))
    total = int(await db.scalar(select(func.count(File.id)).join(User, User.id == File.owner_id).outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)) or 0)
    total_bytes = int(await db.scalar(select(func.coalesce(func.sum(File.size_bytes), 0))) or 0)
    rows = (await db.execute(
        select(File, User, UserProfile).join(User, User.id == File.owner_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)
        .order_by(File.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    items = [{"id": f.id, "owner_id": owner.id, "owner_email": owner.email, "owner_name": (profile.display_name or profile.full_name) if profile else owner.email, "name": f.original_name, "mime_type": f.mime_type, "size_bytes": f.size_bytes, "provider": f.provider, "is_public": f.is_public, "created_at": f.created_at} for f, owner, profile in rows]
    return {"items": items, "total": total, "total_storage_bytes": total_bytes, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_file(file_id: int, request: Request, admin: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    file = (await db.execute(select(File).where(File.id == file_id))).scalar_one_or_none()
    if not file:
        raise NotFoundError("File not found")
    await FileService(db).delete(admin, file_id)
    # FileService emits the normal file.deleted audit event. Add explicit admin context as a second event.
    await AuditService(db).log(action="admin.file_deleted", user_id=admin.id, entity_type="file", entity_id=file_id, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"name": file.original_name, "owner_id": file.owner_id})
    await db.commit()


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
async def admin_create_announcement(payload: AnnouncementCreate, request: Request, admin: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    query = select(User.id).where(User.deleted_at.is_(None), User.status != UserStatus.DELETED)
    if payload.audience == "STUDENT":
        query = query.where(User.role == UserRole.STUDENT)
    elif payload.audience == "TEACHER":
        query = query.where(User.role == UserRole.TEACHER)
    elif payload.audience == "USER":
        query = query.where(User.id == payload.target_user_id)
    recipient_ids = (await db.execute(query)).scalars().all()
    if payload.audience == "USER" and not recipient_ids:
        raise NotFoundError("Target user not found")
    now = _utcnow()
    for recipient_id in recipient_ids:
        db.add(Notification(
            user_id=recipient_id, type="platform_announcement", title=payload.title,
            body=payload.body, link_url=payload.link_url,
            metadata_json={"audience": payload.audience, "created_by": admin.id}, is_read=False,
        ))
    await AuditService(db).log(
        action="admin.announcement_sent", user_id=admin.id, entity_type="announcement",
        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
        metadata={"audience": payload.audience, "recipient_count": len(recipient_ids), "title": payload.title},
    )
    await db.commit()
    return {"recipient_count": len(recipient_ids), "audience": payload.audience, "sent_at": now, "message": "In-app announcement created."}


@router.get("/activity-logs")
async def admin_activity_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None, max_length=150),
    action: Optional[str] = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
):
    filters = []
    if action:
        filters.append(AuditLog.action == action)
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(AuditLog.action.ilike(term), AuditLog.entity_type.ilike(term), AuditLog.entity_id.ilike(term), User.email.ilike(term), UserProfile.full_name.ilike(term)))
    total = int(await db.scalar(select(func.count(AuditLog.id)).select_from(AuditLog).outerjoin(User, User.id == AuditLog.user_id).outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)) or 0)
    rows = (await db.execute(
        select(AuditLog, User, UserProfile).outerjoin(User, User.id == AuditLog.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id).where(*filters)
        .order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).all()
    items = [{"id": log.id, "action": log.action, "entity_type": log.entity_type, "entity_id": log.entity_id, "created_at": log.created_at, "ip_address": log.ip_address, "user_agent": log.user_agent, "actor_id": actor.id if actor else None, "actor_email": actor.email if actor else ((log.metadata_json or {}).get("email")), "actor_name": ((profile.display_name or profile.full_name) if profile else actor.email) if actor else ((log.metadata_json or {}).get("email") or "System"), "metadata": log.metadata_json} for log, actor, profile in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": (total + page_size - 1) // page_size}


@router.get("/search")
async def admin_global_search(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(min_length=2, max_length=150),
):
    term = f"%{q.strip()}%"
    users_result = await db.execute(
        select(User).options(joinedload(User.profile)).outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(User.deleted_at.is_(None), User.status != UserStatus.DELETED,
               or_(User.email.ilike(term), UserProfile.full_name.ilike(term), UserProfile.display_name.ilike(term)))
        .order_by(User.created_at.desc()).limit(6)
    )
    courses_result = await db.execute(
        select(Course).options(joinedload(Course.teacher).joinedload(User.profile))
        .join(User, Course.teacher_id == User.id).outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(or_(Course.title.ilike(term), Course.category.ilike(term), User.email.ilike(term), UserProfile.full_name.ilike(term)))
        .order_by(Course.created_at.desc()).limit(6)
    )
    files_result = await db.execute(
        select(File, User).join(User, User.id == File.owner_id)
        .where(File.original_name.ilike(term)).order_by(File.created_at.desc()).limit(4)
    )
    return {
        "users": [_user_out(u) for u in users_result.unique().scalars().all()],
        "courses": [{"id": c.id, "title": c.title, "category": c.category, "status": c.status.value, "teacher_name": _name(c.teacher)} for c in courses_result.unique().scalars().all()],
        "files": [{"id": f.id, "name": f.original_name, "owner_email": owner.email} for f, owner in files_result.all()],
    }


@router.get("/settings")
async def admin_read_settings():
    """Expose non-secret runtime settings; edits are not supported until platform settings are persisted."""
    return {
        "platform_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "ai": {
            "provider": "Google Gemini" if settings.GEMINI_API_KEY else "Google Gemini (not configured)",
            "model": settings.GEMINI_MODEL,
            "limits_per_user_per_day": {
                "tutor": settings.AI_LIMIT_TUTOR_PER_DAY,
                "video_analysis": settings.AI_LIMIT_VIDEO_PER_DAY,
                "quiz": settings.AI_LIMIT_QUIZ_PER_DAY,
                "notes": settings.AI_LIMIT_NOTES_PER_DAY,
                "teacher": settings.AI_LIMIT_TEACHER_PER_DAY,
            },
        },
        "storage": {"provider": settings.STORAGE_PROVIDER, "bucket_configured": bool(settings.STORAGE_BUCKET)},
        "email": {"configured": bool(settings.SMTP_HOST and settings.SMTP_USERNAME)},
        "editable": False,
    }
