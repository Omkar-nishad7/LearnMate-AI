from typing import Annotated, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.course import Course, CourseLesson, CourseModule, Enrollment, EnrollmentStatus
from app.models.course_resource import CourseResource
from app.models.file import File
from app.models.user import UserRole
from app.schemas.course_resource import CourseResourceCreate, CourseResourceOut
from app.services.storage import get_storage

router = APIRouter(prefix="/course-resources", tags=["course resources"])


async def _find_course(db: AsyncSession, course_id: int) -> Course:
    course = await db.get(Course, course_id)
    if not course:
        raise NotFoundError("Course not found")
    return course


async def _assert_can_manage(user, course: Course) -> None:
    if user.role != UserRole.ADMIN and (user.role != UserRole.TEACHER or course.teacher_id != user.id):
        raise AuthorizationError("You do not have permission to manage this course's resources")


async def _serialize(db: AsyncSession, resource: CourseResource, file: File) -> CourseResourceOut:
    url = await get_storage().url_for(key=file.key, bucket=file.bucket, expires_seconds=3600)
    return CourseResourceOut(
        id=resource.id,
        course_id=resource.course_id,
        lesson_id=resource.lesson_id,
        file_id=resource.file_id,
        title=resource.title,
        description=resource.description,
        resource_type=resource.resource_type,
        original_name=file.original_name,
        mime_type=file.mime_type,
        size_bytes=file.size_bytes,
        download_url=url,
        created_at=resource.created_at,
    )


@router.get("/teacher", response_model=list[CourseResourceOut], dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def list_teacher_resources(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(CourseResource, File)
        .join(Course, Course.id == CourseResource.course_id)
        .join(File, File.id == CourseResource.file_id)
        .order_by(CourseResource.created_at.desc())
    )
    if user.role != UserRole.ADMIN:
        stmt = stmt.where(Course.teacher_id == user.id)
    rows = (await db.execute(stmt)).all()
    return [await _serialize(db, resource, file) for resource, file in rows]


@router.post("/teacher/courses/{course_id}", response_model=CourseResourceOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def create_course_resource(
    course_id: int,
    payload: CourseResourceCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await _find_course(db, course_id)
    await _assert_can_manage(user, course)
    file = await db.get(File, payload.file_id)
    if not file or (user.role != UserRole.ADMIN and file.owner_id != user.id):
        raise NotFoundError("Uploaded file not found in your file library")
    if payload.lesson_id is not None:
        lesson_row = await db.execute(
            select(CourseLesson.id)
            .join(CourseModule, CourseModule.id == CourseLesson.module_id)
            .where(CourseLesson.id == payload.lesson_id, CourseModule.course_id == course_id)
        )
        if lesson_row.scalar_one_or_none() is None:
            raise ValidationError("Choose a lesson that belongs to this course")
    resource = CourseResource(
        course_id=course_id,
        lesson_id=payload.lesson_id,
        file_id=file.id,
        created_by=user.id,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        resource_type=payload.resource_type,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return await _serialize(db, resource, file)


@router.get("/teacher/courses/{course_id}", response_model=list[CourseResourceOut], dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def list_course_resources_for_teacher(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await _find_course(db, course_id)
    await _assert_can_manage(user, course)
    rows = (await db.execute(
        select(CourseResource, File)
        .join(File, File.id == CourseResource.file_id)
        .where(CourseResource.course_id == course_id)
        .order_by(CourseResource.created_at.desc())
    )).all()
    return [await _serialize(db, resource, file) for resource, file in rows]


@router.delete("/teacher/courses/{course_id}/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def delete_course_resource(
    course_id: int,
    resource_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await _find_course(db, course_id)
    await _assert_can_manage(user, course)
    resource = await db.get(CourseResource, resource_id)
    if not resource or resource.course_id != course_id:
        raise NotFoundError("Course resource not found")
    await db.delete(resource)
    await db.commit()


@router.get("/courses/{course_id}", response_model=list[CourseResourceOut])
async def list_course_resources_for_student(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await _find_course(db, course_id)
    is_owner = user.role == UserRole.ADMIN or (user.role == UserRole.TEACHER and course.teacher_id == user.id)
    if not is_owner:
        if user.role != UserRole.STUDENT:
            raise AuthorizationError("You do not have access to these course resources")
        enrollment = (await db.execute(
            select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == user.id)
        )).scalar_one_or_none()
        if not enrollment or enrollment.status == EnrollmentStatus.DROPPED:
            raise AuthorizationError("Enroll in this course to access its resources")
    rows = (await db.execute(
        select(CourseResource, File)
        .join(File, File.id == CourseResource.file_id)
        .where(CourseResource.course_id == course_id)
        .order_by(CourseResource.lesson_id.asc().nullsfirst(), CourseResource.created_at.desc())
    )).all()
    return [await _serialize(db, resource, file) for resource, file in rows]
