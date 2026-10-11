from typing import Optional, Sequence
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.note import Note, NoteVersion


class NoteRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, note_id: int, with_versions: bool = False) -> Optional[Note]:
        stmt = select(Note).where(Note.id == note_id)
        if with_versions:
            stmt = stmt.options(selectinload(Note.versions))
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def create(
        self, *, user_id: int, title: str, content: str,
        course_id=None, video_id=None, is_ai_generated=False, tags=None,
    ) -> Note:
        note = Note(
            user_id=user_id, title=title, content=content,
            course_id=course_id, video_id=video_id,
            is_ai_generated=is_ai_generated, tags=tags, current_version=1,
        )
        self.db.add(note)
        await self.db.flush()
        self.db.add(
            NoteVersion(
                note_id=note.id, version_number=1, title=title,
                content=content, edited_by=user_id,
            )
        )
        await self.db.flush()
        return note

    async def update_content(self, note: Note, *, title: Optional[str], content: Optional[str], edited_by: int) -> Note:
        if title is not None:
            note.title = title
        if content is not None:
            note.content = content
        note.current_version += 1
        self.db.add(
            NoteVersion(
                note_id=note.id, version_number=note.current_version,
                title=note.title, content=note.content, edited_by=edited_by,
            )
        )
        await self.db.flush()
        return note

    async def list_for_user(
        self,
        user_id: int,
        *,
        q: Optional[str] = None,
        course_id: Optional[int] = None,
        video_id: Optional[int] = None,
        archived: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[Sequence[Note], int]:
        stmt = select(Note).where(
            Note.user_id == user_id, Note.is_archived.is_(archived)
        )
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Note.title.like(like), Note.content.like(like)))
        if course_id is not None:
            stmt = stmt.where(Note.course_id == course_id)
        if video_id is not None:
            stmt = stmt.where(Note.video_id == video_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int((await self.db.execute(count_stmt)).scalar_one())
        stmt = stmt.order_by(Note.updated_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return rows, total