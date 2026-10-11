from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def mark_rotated(self, old: RefreshToken, new_id: int) -> None:
        old.revoked = True
        old.revoked_at = datetime.now(timezone.utc)
        old.replaced_by_id = new_id
        await self.db.flush()

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked = True
        token.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def revoke_all_for_user(self, user_id: int) -> None:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
            .values(revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await self.db.execute(stmt)

    async def revoke_chain(self, token: RefreshToken) -> None:
        """Walk forward through replacement chain and revoke all descendants."""
        current = token
        while current.replaced_by_id:
            nxt = await self.db.get(RefreshToken, current.replaced_by_id)
            if not nxt or nxt.revoked:
                break
            await self.revoke(nxt)
            current = nxt