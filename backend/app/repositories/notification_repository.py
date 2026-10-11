from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, notification_id: int) -> Optional[Notification]:
        res = await self.db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return res.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: int,
        type: str,
        title: str,
        body: Optional[str] = None,
        link_url: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Notification:
        n = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            link_url=link_url,
            metadata_json=metadata,
            is_read=False,
        )
        self.db.add(n)
        await self.db.flush()
        return n

    async def list_for_user(
        self,
        user_id: int,
        *,
        unread_only: bool = False,
        page: int = 1,
        page_size: int = 30,
    ) -> tuple[Sequence[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            base = base.where(Notification.is_read.is_(False))

        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            base.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total

    async def unread_count(self, user_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def mark_read(self, notification: Notification) -> Notification:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await self.db.flush()
        return notification

    async def delete(self, notification: Notification) -> None:
        await self.db.delete(notification)
        await self.db.flush()
