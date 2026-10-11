from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# ---------- Summary ----------
class SummaryOutput(BaseModel):
    summary: str = Field(min_length=20, max_length=4000)
    key_points: List[str] = Field(min_length=1, max_length=20)
    topics: List[str] = Field(default_factory=list, max_length=20)
    estimated_study_minutes: int = Field(default=15, ge=1, le=600)


# ---------- Notes ----------
class KeyTerm(BaseModel):
    term: str = Field(min_length=1, max_length=120)
    definition: str = Field(min_length=1, max_length=600)


class NotesOutput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content_markdown: str = Field(min_length=20, max_length=40_000)
    key_terms: List[KeyTerm] = Field(default_factory=list, max_length=100)


# ---------- Quiz ----------
class QuizQuestion(BaseModel):
    question_type: Literal["MCQ", "TRUE_FALSE", "SHORT_ANSWER"] = "MCQ"
    question_text: str = Field(min_length=5, max_length=2000)
    options: Optional[dict[str, str]] = None
    correct_answer: str = Field(min_length=1, max_length=500)
    explanation: Optional[str] = Field(default=None, max_length=2000)
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    topic: Optional[str] = Field(default=None, max_length=200)
    points: int = Field(default=1, ge=1, le=100)

    @field_validator("options")
    @classmethod
    def options_shape(cls, v):
        if v is None:
            return v
        if len(v) < 2 or len(v) > 6:
            raise ValueError("MCQ must have between 2 and 6 options")
        for k in v.keys():
            if not isinstance(k, str) or not k:
                raise ValueError("Option keys must be non-empty strings")
        return v


class QuizOutput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    questions: List[QuizQuestion] = Field(min_length=1, max_length=50)

    @field_validator("questions")
    @classmethod
    def mcq_have_options(cls, qs: List[QuizQuestion]):
        for q in qs:
            if q.question_type == "MCQ":
                if not q.options:
                    raise ValueError("MCQ question missing options")
                if q.correct_answer not in q.options:
                    raise ValueError(
                        f"correct_answer {q.correct_answer!r} not in options keys"
                    )
        return qs


# ---------- Assignment ----------
class RubricItem(BaseModel):
    criterion: str = Field(min_length=1, max_length=200)
    points: int = Field(ge=0, le=1000)


class AssignmentOutput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=10, max_length=4000)
    instructions: str = Field(min_length=10, max_length=20_000)
    max_score: int = Field(default=100, ge=1, le=1000)
    estimated_hours: Optional[int] = Field(default=None, ge=1, le=200)
    rubric: List[RubricItem] = Field(default_factory=list, max_length=30)


# ---------- Course ----------
class CourseLesson(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1000)
    duration_minutes: int = Field(default=20, ge=1, le=600)


class CourseModule(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    lessons: List[CourseLesson] = Field(min_length=1, max_length=30)


class CourseOutput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    short_description: str = Field(min_length=10, max_length=200)
    description: str = Field(min_length=20, max_length=8000)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    duration_hours: int = Field(ge=1, le=500)
    modules: List[CourseModule] = Field(min_length=1, max_length=30)