from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.analytics import StudentAnalyticsOut, TeacherAnalyticsOut
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/student",
    response_model=StudentAnalyticsOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def student_analytics(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return StudentAnalyticsOut(**await AnalyticsService(db).student_overview(user))


@router.get(
    "/teacher",
    response_model=TeacherAnalyticsOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def teacher_analytics(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return TeacherAnalyticsOut(**await AnalyticsService(db).teacher_overview(user))