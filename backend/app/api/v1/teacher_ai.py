from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.ai import (
    AssignmentGenRequest,
    CourseOutlineRequest,
)
from app.services.ai.assignment_service import AssignmentAIService
from app.services.ai.course_service import CourseAIService

router = APIRouter(
    prefix="/teacher/ai",
    tags=["teacher:ai"],
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)


@router.post("/course-outline")
async def generate_course_outline(
    payload: CourseOutlineRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await CourseAIService(db).generate_outline(
        user_id=user.id,
        topic=payload.topic,
        difficulty=payload.difficulty,
        audience=payload.audience,
        num_modules=payload.num_modules,
    )


@router.post("/assignment")
async def generate_assignment(
    payload: AssignmentGenRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await AssignmentAIService(db).generate(
        user_id=user.id,
        topic=payload.topic,
        difficulty=payload.difficulty,
        audience=payload.audience,
        notes=payload.notes,
    )