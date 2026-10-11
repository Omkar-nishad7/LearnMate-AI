from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.youtube import extract_video_id
from app.models.video import ProcessingStatus, VideoSource


class VideoCreateFromYouTube(BaseModel):
    url: str = Field(min_length=10, max_length=1000)
    lesson_id: Optional[int] = None

    @field_validator("url")
    @classmethod
    def youtube_only(cls, v: str) -> str:
        extract_video_id(v.strip())
        return v.strip()


class VideoCreateUpload(BaseModel):
    lesson_id: Optional[int] = None


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    lesson_id: Optional[int] = None
    source: VideoSource
    external_id: Optional[str] = None
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: ProcessingStatus
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VideoAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    status: ProcessingStatus = ProcessingStatus.PENDING
    summary: Optional[str] = None
    # AI output may be an object or array. Keep response validation tolerant.
    key_points: Optional[Any] = None
    notes_json: Optional[Any] = None
    quiz_json: Optional[Any] = None
    transcript: Optional[str] = None
    language: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    error_message: Optional[str] = None


class VideoUpdate(BaseModel):
    """Teacher/admin metadata updates for an existing video."""

    lesson_id: Optional[int] = None
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = None


class VideoStateOut(BaseModel):
    video_id: int
    saved_for_later: bool = False
    last_position_seconds: int = 0
    watched_seconds: int = 0
    duration_seconds: Optional[int] = None
    progress_percent: float = 0.0
    is_completed: bool = False


class VideoStateUpdate(BaseModel):
    saved_for_later: Optional[bool] = None
    last_position_seconds: Optional[int] = Field(default=None, ge=0)
    watched_seconds: Optional[int] = Field(default=None, ge=0)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    is_completed: Optional[bool] = None


# Backward-compatible schemas used by the existing progress API and schemas/__init__.py.
class VideoProgressIn(BaseModel):
    last_position_seconds: int = Field(ge=0)
    watched_seconds: int = Field(ge=0)
    completed: bool = False


class VideoProgressOut(BaseModel):
    video_id: int
    last_position_seconds: int
    progress_percent: float
    is_completed: bool


class VideoStatusOut(BaseModel):
    video_id: int
    status: ProcessingStatus
    task_state: Optional[str] = None
    has_transcript: bool
    analysis_status: ProcessingStatus = ProcessingStatus.PENDING
    ai_ready: bool = False
    error_message: Optional[str] = None
    analysis_error: Optional[str] = None


class VideoDetailOut(VideoOut):
    transcript: Optional[str] = None
    analysis: Optional[VideoAnalysisOut] = None
    state: Optional[VideoStateOut] = None


class VideoCreateResponse(BaseModel):
    video: VideoOut
    task_id: str


class VideoListOut(BaseModel):
    items: list[VideoOut]
    total: int
    page: int
    page_size: int
    pages: int
