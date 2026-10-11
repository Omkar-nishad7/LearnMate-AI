from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AccountNotActiveError,
    AuthenticationError,
    AuthorizationError,
    TokenExpiredError,
    TokenInvalidError,
)
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Missing bearer token")

    try:
        payload = decode_token(credentials.credentials)
    except ExpiredSignatureError:
        raise TokenExpiredError()
    except JWTError:
        raise TokenInvalidError()

    if payload.get("type") != "access":
        raise TokenInvalidError("Not an access token")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise TokenInvalidError()

    user = await UserRepository(db).get_by_id(user_id)
    if not user:
        raise AuthenticationError("User no longer exists")
    if user.status == UserStatus.SUSPENDED:
        raise AccountNotActiveError("Account is suspended")
    if user.status == UserStatus.DELETED:
        raise AuthenticationError("User no longer exists")

    request.state.user_id = user.id
    return user


def require_role(*allowed: UserRole) -> Callable:
    allowed_set = set(allowed)

    async def _checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in allowed_set:
            raise AuthorizationError(
                f"Requires one of roles: {', '.join(r.value for r in allowed_set)}"
            )
        return user

    return _checker


CurrentUser = Annotated[User, Depends(get_current_user)]