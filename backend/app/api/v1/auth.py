from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.core.security import decode_token
from app.dependencies.auth import CurrentUser, get_current_user
from app.dependencies.rate_limit import rate_limit
from app.db.session import get_db
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenPair,
    VerifyEmailRequest,
)
from app.schemas.user import UserOut
from app.config.settings import settings
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[Optional[str], Optional[str]]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


def _token_pair(access: str, refresh: str) -> TokenPair:
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------- Register ----------
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("auth_register", 10, 3600))],
)
async def register(
    payload: RegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ip, ua = _client_meta(request)
    svc = AuthService(db)
    user, access, raw_refresh = await svc.register(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        role=payload.role,
        ip=ip,
        user_agent=ua,
        background_tasks=background_tasks,
    )
    return RegisterResponse(
        user=UserOut.model_validate(user),
        tokens=_token_pair(access, raw_refresh),
        message="Registration successful. You can continue to your dashboard while email verification remains pending.",
    )


# ---------- Login ----------
@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit("auth_login", 20, 300))],
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ip, ua = _client_meta(request)
    svc = AuthService(db)
    user, access, refresh = await svc.login(
        email=payload.email, password=payload.password, ip=ip, user_agent=ua
    )
    return AuthResponse(user=UserOut.model_validate(user), tokens=_token_pair(access, refresh))


# ---------- Refresh ----------
@router.post(
    "/refresh",
    response_model=TokenPair,
    dependencies=[Depends(rate_limit("auth_refresh", 60, 300))],
)
async def refresh(
    payload: RefreshRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ip, ua = _client_meta(request)
    svc = AuthService(db)
    _, access, refresh = await svc.refresh(raw_refresh=payload.refresh_token, ip=ip, user_agent=ua)
    return _token_pair(access, refresh)


# ---------- Logout ----------
@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: Optional[RefreshRequest] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = AuthService(db)
    await svc.logout(raw_refresh=payload.refresh_token if payload else None)
    return MessageResponse(message="Logged out.")


# ---------- Me ----------
@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return UserOut.model_validate(user)


# ---------- Email verification ----------
@router.post(
    "/verify-email",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("auth_verify", 20, 3600))],
)
async def verify_email(
    payload: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await AuthService(db).verify_email(token=payload.token)
    return MessageResponse(message="Email verified.")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("auth_resend_verify", 5, 3600))],
)
async def resend_verification(
    payload: ForgotPasswordRequest,  # same shape: {email}
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await AuthService(db).resend_verification(
        email=payload.email, background_tasks=background_tasks
    )
    return MessageResponse(message="If the account exists, a verification email has been sent.")


# ---------- Password reset ----------
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("auth_forgot", 5, 3600))],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await AuthService(db).forgot_password(
        email=payload.email, background_tasks=background_tasks
    )
    return MessageResponse(message="If the account exists, a reset email has been sent.")


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("auth_reset", 10, 3600))],
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await AuthService(db).reset_password(token=payload.token, new_password=payload.new_password)
    return MessageResponse(message="Password reset successful. Please log in.")