from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user import User, UserProfile, UserRole, UserStatus


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        stmt = (
            select(User)
            .options(joinedload(User.profile))
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .options(joinedload(User.profile))
            .where(User.email == email.lower(), User.deleted_at.is_(None))
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_verification_token(self, token_hash: str) -> Optional[User]:
        stmt = select(User).where(User.email_verification_token == token_hash)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_reset_token(self, token_hash: str) -> Optional[User]:
        stmt = select(User).where(User.password_reset_token == token_hash)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        password_hash: str,
        role: UserRole,
        full_name: str,
        status: UserStatus = UserStatus.PENDING,
    ) -> User:
        user = User(
            email=email.lower(),
            password_hash=password_hash,
            role=role,
            status=status,
            is_email_verified=False,
        )
        user.profile = UserProfile(full_name=full_name, display_name=full_name.split(" ")[0])
        self.db.add(user)
        await self.db.flush()
        return user

    async def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.utcnow()
        await self.db.flush()

    async def set_email_verification_token(self, user: User, token_hash: Optional[str]) -> None:
        user.email_verification_token = token_hash
        await self.db.flush()

    async def mark_email_verified(self, user: User) -> None:
        user.is_email_verified = True
        user.email_verification_token = None
        if user.status == UserStatus.PENDING:
            user.status = UserStatus.ACTIVE
        await self.db.flush()

    async def set_password_reset_token(self, user: User, token_hash: Optional[str], expires: Optional[datetime]) -> None:
        user.password_reset_token = token_hash
        user.password_reset_expires = expires
        await self.db.flush()

    async def update_password(self, user: User, password_hash: str) -> None:
        user.password_hash = password_hash
        user.password_reset_token = None
        user.password_reset_expires = None
        await self.db.flush()

    async def update_profile(self, user: User, **fields) -> None:
        if user.profile is None:
            user.profile = UserProfile(full_name=fields.pop("full_name", "User"))
        for k, v in fields.items():
            if v is not None and hasattr(user.profile, k):
                setattr(user.profile, k, v)
        await self.db.flush()