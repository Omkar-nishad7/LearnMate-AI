from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lesson import LessonOut


class ModuleBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    order_index: int = Field(default=0, ge=0)


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    order_index: Optional[int] = Field(default=None, ge=0)


class ModuleOut(ModuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    created_at: datetime
    updated_at: datetime


class ModuleWithLessonsOut(ModuleOut):
    lessons: List[LessonOut] = []