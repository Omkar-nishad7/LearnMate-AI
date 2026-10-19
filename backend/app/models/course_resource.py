from typing import Optional
from sqlalchemy import BigInteger, ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class CourseResource(Base, TimestampMixin):
    """A teacher-uploaded file linked to a course and optionally a lesson."""

    __tablename__ = "course_resources"
    __table_args__ = (Index("ix_course_resources_course_lesson", "course_id", "lesson_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("course_lessons.id", ondelete="SET NULL"), nullable=True, index=True
    )
    file_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource_type: Mapped[str] = mapped_column(String(30), default="document", nullable=False)
