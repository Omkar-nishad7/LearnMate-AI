from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class LessonCompleteIn(BaseModel):
    video_id: Optional[int] = None
    last_position_seconds: Optional[int] = Field(default=None, ge=0)
    duration_seconds: Optional[int] = Field(default=None, ge=0)


class ProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
    lesson_id: Optional[int] = None
    video_id: Optional[int] = None
    is_completed: bool
    progress_percent: float
    last_position_seconds: Optional[int] = None
    completed_at: Optional[datetime] = None
    updated_at: datetime


class CourseProgressOut(BaseModel):
    course_id: int
    total_lessons: int
    completed_lessons: int
    progress_percent: float
    is_completed: bool
    last_activity_at: Optional[datetime] = None


class VideoProgressIn(BaseModel):
    last_position_seconds: int = Field(ge=0)
    duration_seconds: int = Field(ge=1)
    completed: bool = False


class VideoProgressOut(BaseModel):
    video_id: int
    course_id: int
    lesson_id: Optional[int] = None
    last_position_seconds: int
    progress_percent: float
    is_completed: bool