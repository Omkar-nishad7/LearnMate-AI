from typing import Optional
from pydantic import BaseModel, Field


class SearchItem(BaseModel):
    id: str
    kind: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    published_at: Optional[str] = None
    match: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    courses: list[SearchItem] = Field(default_factory=list)
    videos: list[SearchItem] = Field(default_factory=list)
    notes: list[SearchItem] = Field(default_factory=list)
    teachers: list[SearchItem] = Field(default_factory=list)
    youtube_videos: list[SearchItem] = Field(default_factory=list)
    youtube_channels: list[SearchItem] = Field(default_factory=list)
    youtube_configured: bool = False
    youtube_error: Optional[str] = None


class YouTubeChannelOut(BaseModel):
    channel_id: str
    channel_url: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    subscriber_count: Optional[int] = None
    video_count: Optional[int] = None
    view_count: Optional[int] = None
    uploads_playlist_id: Optional[str] = None
    linked_teacher_id: Optional[int] = None


class YouTubeChannelVideo(BaseModel):
    video_id: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    published_at: Optional[str] = None
    url: str


class YouTubeChannelDetail(BaseModel):
    channel: YouTubeChannelOut
    videos: list[YouTubeChannelVideo] = Field(default_factory=list)


class TeacherChannelLinkIn(BaseModel):
    channel: str = Field(min_length=3, max_length=500)
