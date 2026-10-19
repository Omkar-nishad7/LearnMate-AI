from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CourseResourceCreate(BaseModel):
    file_id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = Field(default=None, max_length=4000)
    lesson_id: Optional[int] = Field(default=None, ge=1)
    resource_type: str = Field(default="document", pattern="^(document|worksheet|slide|image|other)$")


class CourseResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    lesson_id: Optional[int] = None
    file_id: int
    title: str
    description: Optional[str] = None
    resource_type: str
    original_name: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    created_at: datetime
