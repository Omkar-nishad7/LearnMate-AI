from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LessonBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: Optional[str] = None
    video_url: Optional[str] = Field(default=None, max_length=500)
    duration_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    order_index: int = Field(default=0, ge=0)
    is_preview: bool = False


class LessonCreate(LessonBase):
    pass


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = None
    video_url: Optional[str] = Field(default=None, max_length=500)
    duration_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    order_index: Optional[int] = Field(default=None, ge=0)
    is_preview: Optional[bool] = None


class LessonOut(LessonBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module_id: int
    created_at: datetime
    updated_at: datetime