from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError
from app.models.notification import Notification
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository





class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NotificationRepository(db)

    async def notify(
        self,
        *,
        user_id: int,
        type: str,
        title: str,
        body: Optional[str] = None,
        link_url: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        await self.repo.create(
            user_id=user_id, type=type, title=title,
            body=body, link_url=link_url, metadata=metadata,
        )


        # --- append to app/services/notification_service.py ---



    async def list_for_user(
        self, user: User, *, unread_only: bool = False,
        page: int = 1, page_size: int = 30,
    ) -> tuple[Sequence[Notification], int]:
        return await self.repo.list_for_user(
            user.id, unread_only=unread_only, page=page, page_size=page_size
        )

    async def unread_count(self, user: User) -> int:
        return await self.repo.unread_count(user.id)

    async def mark_read(self, user: User, notification_id: int) -> Notification:
        n = await self.repo.get(notification_id)
        if not n:
            raise NotFoundError("Notification not found")
        if n.user_id != user.id:
            raise AuthorizationError("Not your notification")
        await self.repo.mark_read(n)
        await self.db.commit()
        await self.db.refresh(n)
        return n

    async def mark_all_read(self, user: User) -> int:
        items, _ = await self.repo.list_for_user(user.id, unread_only=True, page=1, page_size=500)
        for n in items:
            await self.repo.mark_read(n)
        await self.db.commit()
        return len(items)

    async def delete(self, user: User, notification_id: int) -> None:
        n = await self.repo.get(notification_id)
        if not n:
            raise NotFoundError("Notification not found")
        if n.user_id != user.id:
            raise AuthorizationError("Not your notification")
        await self.db.delete(n)
        await self.db.commit()