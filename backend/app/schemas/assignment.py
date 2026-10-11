from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssignmentQuestion(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=2000)
    options: List[str] = Field(min_length=2, max_length=6)
    correct_option: int = Field(ge=0, le=5)


class AssignmentQuestionStudent(BaseModel):
    id: str
    question: str
    options: List[str]


class AssignmentCreate(BaseModel):
    course_id: int
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=5, max_length=20000)
    instructions: Optional[str] = Field(default=None, max_length=40000)
    attachment_url: Optional[str] = Field(default=None, max_length=500)
    max_score: float = Field(default=100.0, ge=1, le=1000)
    due_at: Optional[datetime] = None
    allow_late: bool = False
    questions: List[AssignmentQuestion] = Field(default_factory=list, min_length=1, max_length=100)


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = Field(default=None, min_length=5, max_length=20000)
    instructions: Optional[str] = Field(default=None, max_length=40000)
    attachment_url: Optional[str] = Field(default=None, max_length=500)
    max_score: Optional[float] = Field(default=None, ge=1, le=1000)
    due_at: Optional[datetime] = None
    allow_late: Optional[bool] = None
    questions: Optional[List[AssignmentQuestion]] = Field(default=None, min_length=1, max_length=100)


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_id: int
    course_id: int
    title: str
    description: str
    instructions: Optional[str] = None
    attachment_url: Optional[str] = None
    max_score: float
    due_at: Optional[datetime] = None
    allow_late: bool
    status: str
    created_at: datetime
    updated_at: datetime
    questions: List[AssignmentQuestion] = Field(default_factory=list)

    @field_validator("questions", mode="before")
    @classmethod
    def normalize_questions(cls, value):
        return value or []


class AssignmentStudentOut(AssignmentOut):
    questions: List[AssignmentQuestionStudent] = Field(default_factory=list)
    attempted: bool = False
    submission_status: Optional[str] = None
    score: Optional[float] = None


class SubmissionCreate(BaseModel):
    content: Optional[str] = Field(default=None, max_length=50000)
    file_url: Optional[str] = Field(default=None, max_length=500)


class SubmissionGrade(BaseModel):
    score: float = Field(ge=0)
    feedback: Optional[str] = Field(default=None, max_length=10000)
    return_to_student: bool = False


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    student_id: int
    content: Optional[str] = None
    file_url: Optional[str] = None
    status: str
    score: Optional[float] = None
    feedback: Optional[str] = None
    graded_by: Optional[int] = None
    graded_at: Optional[datetime] = None
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class SubmissionListOut(BaseModel):
    items: List[SubmissionOut]
    total: int
    page: int
    page_size: int
    pages: int

class AssignmentFeedbackStudent(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    enrollment_status: str
    attempted: bool
    submission_id: Optional[int] = None
    submission_status: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None


class AssignmentFeedbackOut(BaseModel):
    items: List[AssignmentFeedbackStudent]
    total: int
    page: int
    page_size: int
    pages: int
