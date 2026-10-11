from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, DateTime, Enum, ForeignKey, Text, Integer, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.db.base import Base, TimestampMixin


class VideoSource(str, enum.Enum):
    YOUTUBE = "YOUTUBE"
    UPLOAD = "UPLOAD"
    EXTERNAL_URL = "EXTERNAL_URL"


class ProcessingStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Video(Base, TimestampMixin):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("files.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lesson_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("course_lessons.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source: Mapped[VideoSource] = mapped_column(Enum(VideoSource), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, index=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), nullable=False, default=ProcessingStatus.PENDING, index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    analyses: Mapped[list["VideoAnalysis"]] = relationship(
        "VideoAnalysis", back_populates="video", cascade="all, delete-orphan"
    )


class VideoAnalysis(Base, TimestampMixin):
    __tablename__ = "video_analyses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    video_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_points: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    notes_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    quiz_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    model_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus), nullable=False, default=ProcessingStatus.PENDING, index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    video: Mapped[Video] = relationship("Video", back_populates="analyses")