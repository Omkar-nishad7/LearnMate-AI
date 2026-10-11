from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=200_000)
    course_id: Optional[int] = None
    video_id: Optional[int] = None
    tags: Optional[dict] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    content: Optional[str] = Field(default=None, min_length=1, max_length=200_000)
    tags: Optional[dict] = None
    is_archived: Optional[bool] = None
    is_pinned: Optional[bool] = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    course_id: Optional[int] = None
    video_id: Optional[int] = None
    title: str
    content: str
    is_ai_generated: bool
    is_archived: bool
    is_pinned: bool
    tags: Optional[dict] = None
    current_version: int
    created_at: datetime
    updated_at: datetime


class NoteListOut(BaseModel):
    items: List[NoteOut]
    total: int
    page: int
    page_size: int
    pages: int


class NoteVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    version_number: int
    title: str
    content: str
    edited_by: Optional[int] = None
    created_at: datetime