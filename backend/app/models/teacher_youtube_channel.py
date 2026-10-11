from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TeacherYouTubeChannel(Base, TimestampMixin):
    __tablename__ = "teacher_youtube_channels"
    __table_args__ = (
        UniqueConstraint("teacher_id", name="uq_teacher_youtube_channel_teacher"),
        UniqueConstraint("channel_id", name="uq_teacher_youtube_channel_channel"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    channel_url: Mapped[str] = mapped_column(String(500), nullable=False)
    channel_title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    uploads_playlist_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    subscriber_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    video_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    view_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    teacher = relationship("User", foreign_keys=[teacher_id])
