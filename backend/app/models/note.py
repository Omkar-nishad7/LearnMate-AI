from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class Note(Base, TimestampMixin):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    video_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    versions: Mapped[list["NoteVersion"]] = relationship(
        "NoteVersion", back_populates="note", cascade="all, delete-orphan",
        order_by="NoteVersion.version_number.desc()",
    )


class NoteVersion(Base, TimestampMixin):
    __tablename__ = "note_versions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    edited_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    note: Mapped[Note] = relationship("Note", back_populates="versions")