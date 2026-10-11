from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.enrollment_repository import EnrollmentRepository
from app.repositories.user_repository import UserRepository
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_user, require_role
from app.models.course import CourseStatus
from app.models.user import User, UserRole
from app.schemas.course import (
    CourseCreate,
    CourseDetail,
    CourseDetailWithLessons,
    CourseListItem,
    CourseListResponse,
    CourseUpdate,
    EnrollmentOut,
)
from app.schemas.lesson import LessonCreate, LessonOut, LessonUpdate
from app.schemas.video import VideoOut
from app.schemas.module import ModuleCreate, ModuleOut, ModuleUpdate, ModuleWithLessonsOut
from app.services.course_service import CourseService

router = APIRouter(prefix="/courses", tags=["courses"])


# ---------------- Helpers ----------------
def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


# ---------------- Public catalog ----------------
@router.get("", response_model=CourseListResponse)
async def list_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Optional[str] = Query(default=None, max_length=100),
    category: Optional[str] = Query(default=None, max_length=100),
    difficulty: Optional[str] = Query(default=None, max_length=50),
    language: Optional[str] = Query(default=None, max_length=20),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    svc = CourseService(db)
    rows, total = await svc.courses.list_public(
        q=q, category=category, difficulty=difficulty, language=language,
        page=page, page_size=page_size,
    )
    return CourseListResponse(
        items=[CourseListItem.model_validate(r) for r in rows],
        **_paginate(page, page_size, total),
    )


@router.get("/{course_id}/videos", response_model=list[VideoOut])
async def get_course_videos(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    if viewer is None:
        # Do not expose attached course video URLs to anonymous visitors.
        from app.core.exceptions import AuthorizationError
        raise AuthorizationError("Authentication is required to access course videos")
    rows = await CourseService(db).list_course_videos(viewer, course_id)
    return [VideoOut.model_validate(video) for video in rows]


@router.get("/{course_id}", response_model=CourseDetailWithLessons)
async def get_course(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    viewer: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    svc = CourseService(db)
    course = await svc.get_course_for_viewer(viewer, course_id, with_lessons=True)

    # Build the response from the already eager-loaded relationships instead of
    # asking Pydantic to traverse the SQLAlchemy object graph during response
    # serialization. This keeps the student course-detail endpoint safe with
    # AsyncSession and avoids accidental lazy-loading/ORM validation failures.
    return CourseDetailWithLessons(
        id=course.id,
        title=course.title,
        slug=course.slug,
        short_description=course.short_description,
        category=course.category,
        difficulty=course.difficulty,
        language=course.language,
        thumbnail_url=course.thumbnail_url,
        status=course.status,
        is_free=course.is_free,
        price_cents=course.price_cents,
        duration_minutes=course.duration_minutes,
        created_at=course.created_at,
        teacher_id=course.teacher_id,
        description=course.description,
        published_at=course.published_at,
        modules=[
            {
                "id": module.id,
                "course_id": module.course_id,
                "title": module.title,
                "description": module.description,
                "order_index": module.order_index,
                "created_at": module.created_at,
                "updated_at": module.updated_at,
                "lessons": [
                    {
                        "id": lesson.id,
                        "module_id": lesson.module_id,
                        "title": lesson.title,
                        "content": lesson.content,
                        "video_url": lesson.video_url,
                        "duration_minutes": lesson.duration_minutes,
                        "order_index": lesson.order_index,
                        "is_preview": lesson.is_preview,
                        "created_at": lesson.created_at,
                        "updated_at": lesson.updated_at,
                    }
                    for lesson in (module.lessons or [])
                ],
            }
            for module in (course.modules or [])
        ],
    )


# ---------------- Teacher: courses ----------------
teacher_router = APIRouter(
    prefix="/teacher/courses",
    tags=["teacher:courses"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


@teacher_router.post("", response_model=CourseDetail, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    course = await svc.create_course(user, payload.model_dump())
    return CourseDetail.model_validate(course)


@teacher_router.get("/{course_id}", response_model=CourseDetailWithLessons)
async def get_my_course(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await CourseService(db).get_course_for_viewer(user, course_id, with_lessons=True)
    return CourseDetailWithLessons.model_validate(course)


@teacher_router.get("/{course_id}/videos", response_model=list[VideoOut])
async def get_my_course_videos(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = await CourseService(db).list_course_videos(user, course_id)
    return [VideoOut.model_validate(video) for video in rows]


@teacher_router.get("", response_model=CourseListResponse)
async def list_my_courses(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: Optional[CourseStatus] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    svc = CourseService(db)
    rows, total = await svc.courses.list_teacher(
        user.id, status=status_filter, page=page, page_size=page_size
    )
    return CourseListResponse(
        items=[CourseListItem.model_validate(r) for r in rows],
        **_paginate(page, page_size, total),
    )


@teacher_router.patch("/{course_id}", response_model=CourseDetail)
async def update_course(
    course_id: int,
    payload: CourseUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    course = await svc.update_course(user, course_id, payload.model_dump(exclude_unset=True))
    return CourseDetail.model_validate(course)


@teacher_router.post("/{course_id}/publish", response_model=CourseDetail)
async def publish_course(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    course = await svc.publish_course(user, course_id)
    return CourseDetail.model_validate(course)


@teacher_router.post("/{course_id}/archive", response_model=CourseDetail)
async def archive_course(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    course = await svc.archive_course(user, course_id)
    return CourseDetail.model_validate(course)


@teacher_router.post("/{course_id}/unarchive", response_model=CourseDetail)
async def unarchive_course(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    course = await CourseService(db).unarchive_course(user, course_id)
    return CourseDetail.model_validate(course)


@teacher_router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await CourseService(db).delete_course(user, course_id)



@teacher_router.get("/{course_id}/students")
async def list_course_students(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    svc = CourseService(db)
    await svc._get_owned_course(user, course_id)
    er = EnrollmentRepository(db)
    ur = UserRepository(db)
    rows, total = await er.list_students_for_course(course_id, page=page, page_size=page_size)
    items = []
    for enr in rows:
        u = await ur.get_by_id(enr.student_id)
        items.append({
            "student_id": enr.student_id,
            "full_name": u.profile.full_name if u and u.profile else None,
            "email": u.email if u else None,
            "enrolled_at": enr.enrolled_at,
            "status": enr.status.value,
            "progress_percent": enr.progress_percent,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if page_size else 0}
# ---------------- Teacher: modules ----------------
@teacher_router.post(
    "/{course_id}/modules", response_model=ModuleOut, status_code=status.HTTP_201_CREATED
)
async def create_module(
    course_id: int,
    payload: ModuleCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    module = await svc.create_module(user, course_id, payload.model_dump())
    return ModuleOut.model_validate(module)


@teacher_router.get("/{course_id}/modules", response_model=list[ModuleWithLessonsOut])
async def list_modules(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    await svc._get_owned_course(user, course_id)
    modules = await svc.modules.list_by_course(course_id, with_lessons=True)
    return [ModuleWithLessonsOut.model_validate(m) for m in modules]


@teacher_router.patch("/modules/{module_id}", response_model=ModuleOut)
async def update_module(
    module_id: int,
    payload: ModuleUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    module = await svc.update_module(user, module_id, payload.model_dump(exclude_unset=True))
    return ModuleOut.model_validate(module)


@teacher_router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    module_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await CourseService(db).delete_module(user, module_id)


# ---------------- Teacher: lessons ----------------
@teacher_router.post(
    "/modules/{module_id}/lessons",
    response_model=LessonOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_lesson(
    module_id: int,
    payload: LessonCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    lesson = await svc.create_lesson(user, module_id, payload.model_dump())
    return LessonOut.model_validate(lesson)


@teacher_router.patch("/lessons/{lesson_id}", response_model=LessonOut)
async def update_lesson(
    lesson_id: int,
    payload: LessonUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    lesson = await svc.update_lesson(user, lesson_id, payload.model_dump(exclude_unset=True))
    return LessonOut.model_validate(lesson)


@teacher_router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await CourseService(db).delete_lesson(user, lesson_id)


# ---------------- Student: enrollment ----------------
student_router = APIRouter(
    prefix="/student",
    tags=["student:courses"],
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)


@student_router.post(
    "/courses/{course_id}/enroll",
    response_model=EnrollmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def enroll(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    enr = await CourseService(db).enroll(user, course_id)
    return EnrollmentOut.model_validate(enr)


@student_router.delete(
    "/courses/{course_id}/enroll", response_model=EnrollmentOut
)
async def unenroll(
    course_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    enr = await CourseService(db).unenroll(user, course_id)
    return EnrollmentOut.model_validate(enr)


@student_router.get("/enrollments", response_model=list[EnrollmentOut])
async def list_my_enrollments(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    svc = CourseService(db)
    rows, _ = await svc.enrollments.list_for_student(user.id, page=page, page_size=page_size)
    return [EnrollmentOut.model_validate(enr) for enr, _course in rows]


@student_router.get("/lessons/{lesson_id}", response_model=LessonOut)
async def get_lesson_for_student(
    lesson_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = CourseService(db)
    lesson = await svc.get_lesson_for_student(user, lesson_id)
    return LessonOut.model_validate(lesson)