from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config.logging import get_logger
from app.core.exceptions import (
    AccountNotActiveError,
    ConflictError,
    InvalidCredentialsError,
    RefreshTokenReuseError,
    TokenExpiredError,
    TokenInvalidError,
    ValidationError,
)
from app.core.security import (
    create_access_token,
    generate_one_time_token,
    generate_refresh_token,
    hash_one_time_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.config.settings import settings
from app.models.user import User, UserRole, UserStatus
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService
from app.services.email_service import email_service

logger = get_logger("auth")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.tokens = RefreshTokenRepository(db)
        self.audit = AuditService(db)

    # ---------- Register ----------
    async def register(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        role: UserRole,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, str, str]:
        if role == UserRole.ADMIN:
            raise ValidationError("Cannot self-register as ADMIN")

        existing = await self.users.get_by_email(email)
        if existing:
            raise ConflictError("Email is already registered")

        user = await self.users.create(
            email=email,
            password_hash=hash_password(password),
            role=role,
            full_name=full_name,
            status=UserStatus.PENDING,
        )

        # Create the verification token before committing the account.
        # Email delivery is intentionally best-effort so a broken SMTP provider
        # cannot turn a successful database registration into an HTTP 500.
        raw_token = generate_one_time_token()
        await self.users.set_email_verification_token(user, hash_one_time_token(raw_token))

        try:
            email_service.send_verification_email(user.email, raw_token)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "verification_email_failed_during_registration",
                user_id=user.id,
                error=str(exc),
            )

        await self.audit.log(
            action="auth.register",
            user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
            metadata={"role": role.value},
        )

        # Establish the authenticated session immediately after registration.
        # The account can use the dashboard while email verification remains
        # pending. Existing authorization still blocks only suspended/deleted users.
        access = create_access_token(subject=user.id, role=user.role.value)
        raw_refresh = generate_refresh_token()
        await self.tokens.create(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
            ip_address=ip,
        )

        await self.db.commit()

        # Re-read with the profile eagerly loaded. This avoids SQLAlchemy async
        # lazy-loading during Pydantic serialization and prevents registration
        # from failing with MissingGreenlet/response-validation errors.
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == user.id)
        )
        user = result.scalar_one()

        return user, access, raw_refresh

    # ---------- Login ----------
    async def login(
        self,
        *,
        email: str,
        password: str,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, str, str]:
        user = await self.users.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            await self.audit.log(
                action="auth.login_failed",
                ip_address=ip,
                user_agent=user_agent,
                metadata={"email": email},
            )
            await self.db.commit()
            raise InvalidCredentialsError()

        if user.status == UserStatus.SUSPENDED:
            raise AccountNotActiveError("Account is suspended")
        if user.status == UserStatus.DELETED:
            raise InvalidCredentialsError()

        access = create_access_token(subject=user.id, role=user.role.value)
        raw_refresh = generate_refresh_token()
        await self.tokens.create(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
            ip_address=ip,
        )
        await self.users.update_last_login(user)
        await self.audit.log(
            action="auth.login_success",
            user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
        )
        await self.db.commit()
        return user, access, raw_refresh

    # ---------- Refresh (rotation + reuse detection) ----------
    async def refresh(
        self,
        *,
        raw_refresh: str,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> tuple[User, str, str]:
        token_hash = hash_refresh_token(raw_refresh)
        stored = await self.tokens.get_by_hash(token_hash)

        if not stored:
            raise TokenInvalidError("Refresh token not recognized")

        now = datetime.now(timezone.utc)

        # Reuse of a revoked token => compromise. Revoke entire chain & fail.
        if stored.revoked:
            await self.tokens.revoke_chain(stored)
            await self.audit.log(
                action="auth.refresh_reuse_detected",
                user_id=stored.user_id,
                ip_address=ip,
                user_agent=user_agent,
            )
            await self.db.commit()
            raise RefreshTokenReuseError()

        if stored.expires_at < now:
            await self.tokens.revoke(stored)
            await self.db.commit()
            raise TokenExpiredError("Refresh token has expired")

        user = await self.users.get_by_id(stored.user_id)
        if not user or user.status in (UserStatus.SUSPENDED, UserStatus.DELETED):
            raise AccountNotActiveError()

        # rotate
        raw_new = generate_refresh_token()
        new_token = await self.tokens.create(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_new),
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
            ip_address=ip,
        )
        await self.tokens.mark_rotated(stored, new_token.id)
        access = create_access_token(subject=user.id, role=user.role.value)

        await self.audit.log(
            action="auth.refresh_success",
            user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
        )
        await self.db.commit()
        return user, access, raw_new

    # ---------- Logout ----------
    async def logout(self, *, raw_refresh: Optional[str], user_id: Optional[int] = None) -> None:
        if raw_refresh:
            stored = await self.tokens.get_by_hash(hash_refresh_token(raw_refresh))
            if stored:
                await self.tokens.revoke(stored)
        elif user_id is not None:
            await self.tokens.revoke_all_for_user(user_id)
        await self.db.commit()

    # ---------- Email verification ----------
    async def verify_email(self, *, token: str) -> None:
        user = await self.users.get_by_verification_token(hash_one_time_token(token))
        if not user:
            raise TokenInvalidError("Verification token invalid or already used")
        await self.users.mark_email_verified(user)
        await self.db.commit()

    async def resend_verification(self, *, email: str) -> None:
        user = await self.users.get_by_email(email)
        if not user or user.is_email_verified:
            # Do not leak account existence
            return
        raw = generate_one_time_token()
        await self.users.set_email_verification_token(user, hash_one_time_token(raw))
        email_service.send_verification_email(user.email, raw)
        await self.db.commit()

    # ---------- Password reset ----------
    async def forgot_password(self, *, email: str) -> None:
        user = await self.users.get_by_email(email)
        if not user:
            # Do not leak account existence
            return
        raw = generate_one_time_token()
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        await self.users.set_password_reset_token(user, hash_one_time_token(raw), expires)
        email_service.send_password_reset_email(user.email, raw)
        await self.audit.log(action="auth.password_reset_requested", user_id=user.id)
        await self.db.commit()

    async def reset_password(self, *, token: str, new_password: str) -> None:
        user = await self.users.get_by_reset_token(hash_one_time_token(token))
        if not user or not user.password_reset_expires:
            raise TokenInvalidError("Reset token invalid")
        if user.password_reset_expires < datetime.now(timezone.utc):
            raise TokenExpiredError("Reset token has expired")

        await self.users.update_password(user, hash_password(new_password))
        # revoke all active refresh tokens (forces re-login on all devices)
        await self.tokens.revoke_all_for_user(user.id)
        await self.audit.log(action="auth.password_reset_completed", user_id=user.id)
        await self.db.commit()