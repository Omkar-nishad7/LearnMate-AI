from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ConversationStartIn(BaseModel):
    other_user_id: int = Field(gt=0)
    course_id: Optional[int] = None


class MessageSendIn(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    body: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_a_id: int
    user_b_id: int
    course_id: Optional[int] = None
    course_title: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ConversationListItem(ConversationOut):
    other_user_id: int
    other_user_name: Optional[str] = None
    last_message_body: Optional[str] = None
    last_message_sender_id: Optional[int] = None
    unread_count: int = 0


class ConversationDetailOut(ConversationOut):
    other_user_id: int
    other_user_name: Optional[str] = None
    unread_count: int = 0


class MessageListOut(BaseModel):
    items: List[MessageOut]
    next_before_id: Optional[int] = None  # cursor for older messages
    has_more: bool = False


class UnreadCountOut(BaseModel):
    total: int


class ChatConversationListOut(BaseModel):
    items: List[ConversationListItem]
    total: int
    page: int
    page_size: int
    pages: int