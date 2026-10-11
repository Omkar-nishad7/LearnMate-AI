from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentFeedbackOut,
    AssignmentOut,
    AssignmentStudentOut,
    AssignmentUpdate,
    SubmissionCreate,
    SubmissionGrade,
    SubmissionListOut,
    SubmissionOut,
)
from app.services.assignment_service import AssignmentService

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


# ---------------- Teacher ----------------
@router.post(
    "",
    response_model=AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def create_assignment(
    payload: AssignmentCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return AssignmentOut.model_validate(
        await AssignmentService(db).create_assignment(user, payload.model_dump())
    )


@router.get(
    "/teacher/{assignment_id}",
    response_model=AssignmentOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def get_teacher_assignment(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return AssignmentOut.model_validate(
        await AssignmentService(db).get_for_teacher(user, assignment_id)
    )


@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def delete_assignment(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await AssignmentService(db).delete_assignment(user, assignment_id)
    return None


@router.patch(
    "/{assignment_id}",
    response_model=AssignmentOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def update_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return AssignmentOut.model_validate(
        await AssignmentService(db).update_assignment(
            user, assignment_id, payload.model_dump(exclude_unset=True)
        )
    )


@router.post(
    "/{assignment_id}/publish",
    response_model=AssignmentOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def publish_assignment(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return AssignmentOut.model_validate(
        await AssignmentService(db).publish_assignment(user, assignment_id)
    )


@router.post(
    "/{assignment_id}/close",
    response_model=AssignmentOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def close_assignment(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return AssignmentOut.model_validate(
        await AssignmentService(db).close_assignment(user, assignment_id)
    )


@router.get(
    "/{assignment_id}/submissions",
    response_model=SubmissionListOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def list_submissions(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    rows, total = await AssignmentService(db).list_submissions(
        user, assignment_id, page=page, page_size=page_size
    )
    return SubmissionListOut(
        items=[SubmissionOut.model_validate(r) for r in rows],
        **_paginate(page, page_size, total),
    )


@router.get(
    "/{assignment_id}/feedback",
    response_model=AssignmentFeedbackOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def assignment_feedback(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=500),
):
    rows, total = await AssignmentService(db).list_feedback(
        user, assignment_id, page=page, page_size=page_size
    )
    return AssignmentFeedbackOut(
        items=rows,
        **_paginate(page, page_size, total),
    )


@router.post(
    "/submissions/{submission_id}/grade",
    response_model=SubmissionOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def grade_submission(
    submission_id: int,
    payload: SubmissionGrade,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return SubmissionOut.model_validate(
        await AssignmentService(db).grade_submission(
            user, submission_id,
            score=payload.score, feedback=payload.feedback,
            return_to_student=payload.return_to_student,
        )
    )


@router.get("/teacher", response_model=list[AssignmentOut], dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def list_teacher_assignments(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = AssignmentService(db)
    courses, _ = await svc.courses.list_teacher(user.id, page=1, page_size=200)
    items = []
    for course in courses:
        items.extend(await svc.list_for_course(user, course.id))
    return [AssignmentOut.model_validate(a) for a in items]


@router.get("/course/{course_id}", response_model=list[AssignmentStudentOut])
async def list_course_assignments(
    course_id: int, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    svc = AssignmentService(db)
    rows = await svc.list_for_student_course(user, course_id)
    out = []
    for a in rows:
        item = AssignmentStudentOut.model_validate(a)
        item.questions = svc.student_questions(a)
        sub = await svc.assignments.find_submission(a.id, user.id)
        item.attempted = sub is not None
        item.submission_status = sub.status.value if sub else None
        item.score = sub.score if sub else None
        out.append(item)
    return out


# ---------------- Student ----------------
@router.get("", response_model=list[AssignmentStudentOut])
async def list_assignments(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = AssignmentService(db)
    rows = await svc.list_for_student(user)
    out = []
    for a in rows:
        item = AssignmentStudentOut.model_validate(a)
        item.questions = svc.student_questions(a)
        sub = await svc.assignments.find_submission(a.id, user.id)
        item.attempted = sub is not None
        item.submission_status = sub.status.value if sub else None
        item.score = sub.score if sub else None
        out.append(item)
    return out


@router.get("/{assignment_id}", response_model=AssignmentStudentOut)
async def get_assignment(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = AssignmentService(db)
    a = await svc.get_for_student(user, assignment_id)
    item = AssignmentStudentOut.model_validate(a)
    item.questions = svc.student_questions(a)
    sub = await svc.assignments.find_submission(a.id, user.id)
    item.attempted = sub is not None
    item.submission_status = sub.status.value if sub else None
    item.score = sub.score if sub else None
    return item


@router.post(
    "/{assignment_id}/submit",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def submit_assignment(
    assignment_id: int,
    payload: SubmissionCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return SubmissionOut.model_validate(
        await AssignmentService(db).submit(user, assignment_id, payload.model_dump())
    )


@router.get("/{assignment_id}/my-submission", response_model=SubmissionOut)
async def my_submission(
    assignment_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return SubmissionOut.model_validate(
        await AssignmentService(db).get_my_submission(user, assignment_id)
    )