from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError
from app.models.note import Note, NoteVersion
from app.models.user import User
from app.repositories.note_repository import NoteRepository
from app.services.audit_service import AuditService


class NoteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NoteRepository(db)
        self.audit = AuditService(db)

    async def create(self, user: User, data: dict) -> Note:
        note = await self.repo.create(
            user_id=user.id,
            title=data["title"],
            content=data["content"],
            course_id=data.get("course_id"),
            video_id=data.get("video_id"),
            is_ai_generated=False,
            tags=data.get("tags"),
        )
        await self.audit.log(
            action="note.created", user_id=user.id, entity_type="note", entity_id=note.id
        )
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def list_mine(
        self,
        user: User,
        *,
        q: Optional[str] = None,
        course_id: Optional[int] = None,
        video_id: Optional[int] = None,
        archived: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Note], int]:
        return await self.repo.list_for_user(
            user.id, q=q, course_id=course_id, video_id=video_id, archived=archived,
            page=page, page_size=page_size,
        )

    async def get(self, user: User, note_id: int) -> Note:
        note = await self.repo.get(note_id)
        if not note:
            raise NotFoundError("Note not found")
        if note.user_id != user.id:
            raise NotFoundError("Note not found")  # do not leak
        return note

    async def update(self, user: User, note_id: int, data: dict) -> Note:
        note = await self.get(user, note_id)
        # title/content changes create a version snapshot
        if data.get("title") is not None or data.get("content") is not None:
            await self.repo.update_content(
                note,
                title=data.get("title"),
                content=data.get("content"),
                edited_by=user.id,
            )
        if data.get("tags") is not None:
            note.tags = data["tags"]
        if data.get("is_archived") is not None:
            note.is_archived = data["is_archived"]
        if data.get("is_pinned") is not None:
            note.is_pinned = data["is_pinned"]
        await self.db.flush()
        await self.audit.log(
            action="note.updated", user_id=user.id, entity_type="note", entity_id=note.id
        )
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def delete(self, user: User, note_id: int) -> None:
        note = await self.get(user, note_id)
        await self.db.delete(note)
        await self.audit.log(
            action="note.deleted", user_id=user.id, entity_type="note", entity_id=note_id
        )
        await self.db.commit()

    async def versions(self, user: User, note_id: int) -> list[NoteVersion]:
        await self.get(user, note_id)  # ownership check
        note = await self.repo.get(note_id, with_versions=True)
        return list(note.versions) if note else []