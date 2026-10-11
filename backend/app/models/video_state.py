from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class VideoUserState(Base, TimestampMixin):
    """Per-user playback/bookmark state for a video.

    This is intentionally separate from course progress because imported
    YouTube videos may not belong to a course/lesson at all.
    """

    __tablename__ = "video_user_state"
    __table_args__ = (
        UniqueConstraint("user_id", "video_id", name="uq_video_user_state_user_video"),
        Index("ix_video_user_state_user_saved", "user_id", "saved_for_later"),
        Index("ix_video_user_state_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    saved_for_later: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_position_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watched_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_watched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
