from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.note import (
    NoteCreate,
    NoteListOut,
    NoteOut,
    NoteUpdate,
    NoteVersionOut,
)
from app.services.note_service import NoteService

router = APIRouter(prefix="/notes", tags=["notes"])


def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return NoteOut.model_validate(
        await NoteService(db).create(user, payload.model_dump())
    )


@router.get("", response_model=NoteListOut)
async def list_notes(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Optional[str] = Query(default=None, max_length=200),
    course_id: Optional[int] = Query(default=None),
    video_id: Optional[int] = Query(default=None),
    archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    rows, total = await NoteService(db).list_mine(
        user, q=q, course_id=course_id, video_id=video_id, archived=archived,
        page=page, page_size=page_size,
    )
    return NoteListOut(
        items=[NoteOut.model_validate(n) for n in rows],
        **_paginate(page, page_size, total),
    )


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return NoteOut.model_validate(await NoteService(db).get(user, note_id))


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: int,
    payload: NoteUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return NoteOut.model_validate(
        await NoteService(db).update(user, note_id, payload.model_dump(exclude_unset=True))
    )


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await NoteService(db).delete(user, note_id)


@router.get("/{note_id}/versions", response_model=list[NoteVersionOut])
async def note_versions(
    note_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = await NoteService(db).versions(user, note_id)
    return [NoteVersionOut.model_validate(v) for v in rows]