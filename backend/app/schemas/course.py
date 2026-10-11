from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseStatus, EnrollmentStatus
from app.schemas.module import ModuleOut, ModuleWithLessonsOut


class CourseBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = None
    short_description: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=100)
    difficulty: Optional[str] = Field(default=None, max_length=50)
    language: str = Field(default="en", max_length=20)
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)
    is_free: bool = True
    price_cents: int = Field(default=0, ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=0)


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = None
    short_description: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=100)
    difficulty: Optional[str] = Field(default=None, max_length=50)
    language: Optional[str] = Field(default=None, max_length=20)
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)
    is_free: Optional[bool] = None
    price_cents: Optional[int] = Field(default=None, ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=0)


class CourseListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    language: str
    thumbnail_url: Optional[str] = None
    status: CourseStatus
    is_free: bool
    price_cents: int
    duration_minutes: Optional[int] = None
    created_at: datetime
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    teacher_avatar_url: Optional[str] = None
    # Populated by the public catalog endpoint; optional so teacher/admin
    # course responses remain backwards compatible.
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    teacher_avatar_url: Optional[str] = None


class CourseDetail(CourseListItem):
    description: Optional[str] = None
    teacher_id: int
    published_at: Optional[datetime] = None
    modules: List[ModuleOut] = Field(default_factory=list)


class CourseDetailWithLessons(CourseDetail):
    modules: List[ModuleWithLessonsOut] = Field(default_factory=list)  # type: ignore[assignment]


class CourseListResponse(BaseModel):
    items: List[CourseListItem]
    total: int
    page: int
    page_size: int
    pages: int


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
    status: EnrollmentStatus
    progress_percent: float
    enrolled_at: datetime
    completed_at: Optional[datetime] = None