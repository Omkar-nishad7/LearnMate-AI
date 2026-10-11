from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, DateTime, ForeignKey, Integer, Float, Boolean, JSON, Index,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class Progress(Base, TimestampMixin):
    __tablename__ = "progress"
    __table_args__ = (
        Index("ix_progress_student_course", "student_id", "course_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("course_lessons.id", ondelete="SET NULL"), nullable=True
    )
    video_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_position_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class LearningActivity(Base, TimestampMixin):
    __tablename__ = "learning_activity"
    __table_args__ = (
        Index("ix_learning_activity_student_created", "student_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    lesson_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("course_lessons.id", ondelete="SET NULL"), nullable=True
    )
    video_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True
    )
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)