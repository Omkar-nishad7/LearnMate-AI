from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserOut, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(user: CurrentUser):
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserProfileUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = UserRepository(db)
    await repo.update_profile(user, **payload.model_dump(exclude_unset=True))
    await db.commit()
    refreshed = await repo.get_by_id(user.id)
    return UserOut.model_validate(refreshed)