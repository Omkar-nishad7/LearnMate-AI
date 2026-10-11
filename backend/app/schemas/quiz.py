from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------- Question (student-safe shape: no correct_answer) ----------
class QuizQuestionStudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_type: str
    question_text: str
    options: Optional[Dict[str, str]] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    points: int
    order_index: int


# ---------- Question (teacher/authoring shape) ----------
class QuizQuestionAuthorOut(QuizQuestionStudentOut):
    correct_answer: str
    explanation: Optional[str] = None


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    course_id: Optional[int] = None
    lesson_id: Optional[int] = None
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    max_attempts: int = Field(default=1, ge=1, le=20)
    pass_percentage: float = Field(default=60.0, ge=0, le=100)


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=600)
    max_attempts: Optional[int] = Field(default=None, ge=1, le=20)
    pass_percentage: Optional[float] = Field(default=None, ge=0, le=100)


class QuizQuestionCreate(BaseModel):
    question_type: str = Field(default="MCQ", pattern="^(MCQ|TRUE_FALSE|SHORT_ANSWER)$")
    question_text: str = Field(min_length=5, max_length=2000)
    options: Optional[Dict[str, str]] = None
    correct_answer: str = Field(min_length=1, max_length=500)
    explanation: Optional[str] = Field(default=None, max_length=2000)
    difficulty: Optional[str] = Field(default=None, max_length=20)
    topic: Optional[str] = Field(default=None, max_length=200)
    points: int = Field(default=1, ge=1, le=100)
    order_index: int = Field(default=0, ge=0)


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_id: int
    course_id: Optional[int] = None
    lesson_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    is_ai_generated: bool
    time_limit_minutes: Optional[int] = None
    max_attempts: int
    pass_percentage: float
    total_points: int
    created_at: datetime
    updated_at: datetime


class StudentQuizOut(QuizOut):
    """Student list shape with attempt state and safe actions."""

    attempted: bool = False
    attempt_id: Optional[int] = None
    attempt_score: Optional[float] = None
    attempt_percentage: Optional[float] = None
    attempt_passed: Optional[bool] = None
    attempt_completed_at: Optional[datetime] = None
    attempt_count: int = 0
    can_attempt: bool = True
    can_delete: bool = False


class QuizDetailOut(QuizOut):
    questions: List[QuizQuestionStudentOut] = []


class QuizAuthorDetailOut(QuizOut):
    questions: List[QuizQuestionAuthorOut] = []


# ---------- Attempts ----------
class AnswerIn(BaseModel):
    question_id: int
    given_answer: Optional[str] = Field(default=None, max_length=2000)


class AttemptStartOut(BaseModel):
    attempt_id: int
    quiz: QuizDetailOut
    started_at: datetime


class AttemptSubmitIn(BaseModel):
    answers: List[AnswerIn] = Field(min_length=1)
    time_taken_seconds: Optional[int] = Field(default=None, ge=0, le=86400)


class AttemptAnswerOut(BaseModel):
    question_id: int
    given_answer: Optional[str] = None
    correct_answer: str
    is_correct: bool
    points_awarded: float
    explanation: Optional[str] = None


class AttemptResultOut(BaseModel):
    attempt_id: int
    quiz_id: int
    score: float
    max_score: float
    percentage: float
    passed: bool
    time_taken_seconds: Optional[int] = None
    weak_topics: Optional[List[dict]] = None
    answers: List[AttemptAnswerOut] = []
    started_at: datetime
    completed_at: Optional[datetime] = None