from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------- Tutor ----------------
class TutorAskRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: Optional[int] = None
    course_id: Optional[int] = None
    video_id: Optional[int] = None
    playback_position_seconds: Optional[int] = Field(default=None, ge=0)


class AIMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: str
    content: str
    tokens_used: Optional[int] = None
    model: Optional[str] = None
    created_at: datetime


class AIConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    feature: str
    title: str
    course_id: Optional[int] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class TutorAskResponse(BaseModel):
    conversation: AIConversationOut
    message: AIMessageOut


class ConversationDetailOut(AIConversationOut):
    messages: List[AIMessageOut] = []


# ---------------- Video AI ----------------
class SummaryRequest(BaseModel):
    video_id: int


class SummaryOut(BaseModel):
    summary: str
    key_points: List[str]
    topics: List[str]
    estimated_study_minutes: int


class NotesFromVideoRequest(BaseModel):
    video_id: int
    course_id: Optional[int] = None


class NotesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    video_id: Optional[int] = None
    course_id: Optional[int] = None
    is_ai_generated: bool
    created_at: datetime


class QuizFromVideoRequest(BaseModel):
    video_id: int
    num_questions: int = Field(default=5, ge=1, le=25)
    course_id: Optional[int] = None


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    is_ai_generated: bool
    total_points: int
    created_at: datetime


# ---------------- Teacher AI Studio ----------------
class CourseOutlineRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    difficulty: str = Field(default="beginner", max_length=20)
    audience: str = Field(default="general learners", max_length=200)
    num_modules: int = Field(default=4, ge=1, le=20)


class AssignmentGenRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    difficulty: str = Field(default="intermediate", max_length=20)
    audience: str = Field(default="undergraduate students", max_length=200)
    notes: str = Field(default="", max_length=2000)


class UsageOut(BaseModel):
    feature: str
    remaining_today: int