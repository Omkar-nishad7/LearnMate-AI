from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    title: str
    body: Optional[str] = None
    link_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationListOut(BaseModel):
    items: List[NotificationOut]
    total: int
    page: int
    page_size: int
    pages: int


class UnreadCountOut(BaseModel):
    unread: int


class MessageResponse(BaseModel):
    message: str