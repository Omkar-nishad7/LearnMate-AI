from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, String, DateTime, ForeignKey, Integer, Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class File(Base, TimestampMixin):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bucket: Mapped[str] = mapped_column(String(100), nullable=False)
    key: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(300), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    provider: Mapped[str] = mapped_column(String(50), default="local", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)