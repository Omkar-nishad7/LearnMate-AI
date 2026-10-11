from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict

from app.schemas.course import CourseListItem
from app.schemas.search import YouTubeChannelOut


class TeacherPublicProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    organization: Optional[str] = None
    joined_at: datetime
    youtube_channel: Optional[YouTubeChannelOut] = None
    courses: List[CourseListItem] = []
