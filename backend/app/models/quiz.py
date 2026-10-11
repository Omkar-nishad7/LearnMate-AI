from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, DateTime, Enum, ForeignKey, Text, Integer, Float, JSON, Boolean, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.db.base import Base, TimestampMixin


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    TRUE_FALSE = "TRUE_FALSE"
    SHORT_ANSWER = "SHORT_ANSWER"


class QuizStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Quiz(Base, TimestampMixin):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    creator_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("course_lessons.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[QuizStatus] = mapped_column(
        Enum(QuizStatus), nullable=False, default=QuizStatus.DRAFT, index=True
    )
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    pass_percentage: Mapped[float] = mapped_column(Float, default=60.0, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="quiz", cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt", back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(Base, TimestampMixin):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    quiz_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType), nullable=False, default=QuestionType.MCQ
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    topic: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    points: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base, TimestampMixin):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_student_quiz", "student_id", "quiz_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    quiz_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    weak_topics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="attempts")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        "QuizAnswer", back_populates="attempt", cascade="all, delete-orphan"
    )


class QuizAnswer(Base, TimestampMixin):
    __tablename__ = "quiz_answers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    given_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    points_awarded: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    attempt: Mapped[QuizAttempt] = relationship("QuizAttempt", back_populates="answers")