from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    BigInteger, String, Boolean, DateTime, Enum, ForeignKey, Text, Integer, Float, UniqueConstraint, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
from app.db.base import Base, TimestampMixin


class CourseStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    DROPPED = "DROPPED"


class Course(Base, TimestampMixin):
    __tablename__ = "courses"
    __table_args__ = (
        Index("ix_courses_teacher_status", "teacher_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(220), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    short_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    difficulty: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus), default=CourseStatus.DRAFT, nullable=False, index=True
    )
    is_free: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    teacher: Mapped["User"] = relationship(
        "User",
        foreign_keys=[teacher_id],
        lazy="selectin",
    )

    @property
    def teacher_name(self) -> Optional[str]:
        profile = getattr(self.teacher, "profile", None)
        if profile:
            return profile.display_name or profile.full_name
        return None

    @property
    def teacher_avatar_url(self) -> Optional[str]:
        profile = getattr(self.teacher, "profile", None)
        return profile.avatar_url if profile else None

    modules: Mapped[List["CourseModule"]] = relationship(
        "CourseModule",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseModule.order_index",
    )
    enrollments: Mapped[List["Enrollment"]] = relationship(
        "Enrollment",
        back_populates="course",
        cascade="all, delete-orphan",
    )


class CourseModule(Base, TimestampMixin):
    __tablename__ = "course_modules"
    __table_args__ = (
        UniqueConstraint("course_id", "order_index", name="uq_module_course_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    course: Mapped["Course"] = relationship("Course", back_populates="modules")
    lessons: Mapped[List["CourseLesson"]] = relationship(
        "CourseLesson",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="CourseLesson.order_index",
    )


class CourseLesson(Base, TimestampMixin):
    __tablename__ = "course_lessons"
    __table_args__ = (
        UniqueConstraint("module_id", "order_index", name="uq_lesson_module_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("course_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_preview: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    module: Mapped["CourseModule"] = relationship("CourseModule", back_populates="lessons")


class Enrollment(Base, TimestampMixin):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course"),
        Index("ix_enrollments_student_status", "student_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE, nullable=False, index=True
    )
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship("Course", back_populates="enrollments")
