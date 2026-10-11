from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, DateTime, Enum, ForeignKey, Text, Integer, Float, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.db.base import Base, TimestampMixin


class AssignmentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    CLOSED = "CLOSED"


class SubmissionStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"
    RETURNED = "RETURNED"
    LATE = "LATE"


class Assignment(Base, TimestampMixin):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    creator_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    questions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    max_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    allow_late: Mapped[bool] = mapped_column(default=False, nullable=False)
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.DRAFT, index=True
    )

    submissions: Mapped[list["AssignmentSubmission"]] = relationship(
        "AssignmentSubmission", back_populates="assignment", cascade="all, delete-orphan"
    )


class AssignmentSubmission(Base, TimestampMixin):
    __tablename__ = "assignment_submissions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus), nullable=False, default=SubmissionStatus.SUBMITTED, index=True
    )
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    graded_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    assignment: Mapped[Assignment] = relationship("Assignment", back_populates="submissions")