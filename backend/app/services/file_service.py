from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.logging import get_logger
from app.core.exceptions import AuthorizationError, NotFoundError
from app.core.file_utils import (
    build_storage_key,
    safe_filename,
    sha256_bytes,
    sniff_mime,
    validate_category,
)
from app.config.settings import settings
from app.models.file import File
from app.models.user import User, UserRole
from app.repositories.file_repository import FileRepository
from app.services.audit_service import AuditService
from app.services.storage import get_storage

logger = get_logger("file")

# Per-user storage quota (bytes). Configurable via env in a later milestone.
DEFAULT_USER_QUOTA_BYTES = 1024 * 1024 * 1024  # 1 GB


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FileRepository(db)
        self.audit = AuditService(db)
        self.storage = get_storage()

    async def upload(
        self,
        user: User,
        *,
        filename: str,
        data: bytes,
        declared_content_type: Optional[str],
        category: str = "document",
        is_public: bool = False,
    ) -> File:
        if not data:
            raise NotFoundError("Empty file")
        header = data[:16]
        mime = sniff_mime(header, filename) or declared_content_type or "application/octet-stream"
        size = len(data)
        validate_category(category, mime, size)

        used = await self.repo.total_bytes_for_owner(user.id)
        if used + size > DEFAULT_USER_QUOTA_BYTES:
            from app.core.exceptions import AppError
            raise AppError("Storage quota exceeded", code="STORAGE_QUOTA_EXCEEDED", status_code=413)

        key = build_storage_key(owner_id=user.id, category=category, filename=filename)
        bucket = settings.STORAGE_BUCKET
        stored = await self.storage.put(key=key, data=data, content_type=mime, bucket=bucket)

        f = await self.repo.create(
            owner_id=user.id,
            bucket=stored.bucket,
            key=stored.key,
            original_name=safe_filename(filename),
            mime_type=mime,
            size_bytes=size,
            checksum=sha256_bytes(data),
            provider=settings.STORAGE_PROVIDER,
            is_public=is_public,
        )
        await self.audit.log(
            action="file.uploaded", user_id=user.id,
            entity_type="file", entity_id=f.id,
            metadata={"size": size, "mime": mime, "category": category},
        )
        await self.db.commit()
        await self.db.refresh(f)
        return f

    async def list_mine(
        self, user: User, *, page: int = 1, page_size: int = 30
    ) -> tuple[list[File], int]:
        return await self.repo.list_for_owner(user.id, page=page, page_size=page_size)

    async def get_for_viewer(self, user: User, file_id: int) -> File:
        f = await self.repo.get(file_id)
        if not f:
            raise NotFoundError("File not found")
        if f.is_public or f.owner_id == user.id or user.role == UserRole.ADMIN:
            return f
        raise AuthorizationError("You do not have access to this file")

    async def download(self, user: User, file_id: int) -> tuple[File, bytes]:
        f = await self.get_for_viewer(user, file_id)
        data = await self.storage.get(key=f.key, bucket=f.bucket)
        return f, data

    async def url_for(self, file: File, *, expires_seconds: int = 3600) -> str:
        return await self.storage.url_for(
            key=file.key, bucket=file.bucket, expires_seconds=expires_seconds
        )

    async def delete(self, user: User, file_id: int) -> None:
        f = await self.repo.get(file_id)
        if not f:
            raise NotFoundError("File not found")
        if f.owner_id != user.id and user.role != UserRole.ADMIN:
            raise AuthorizationError("You do not own this file")
        try:
            await self.storage.delete(key=f.key, bucket=f.bucket)
        except Exception as e:  # noqa: BLE001
            logger.warning("storage_delete_failed", key=f.key, error=str(e))
        await self.repo.delete(f)
        await self.audit.log(
            action="file.deleted", user_id=user.id, entity_type="file", entity_id=file_id
        )
        await self.db.commit()

    async def store_bytes(
        self,
        *,
        owner_id: int,
        filename: str,
        data: bytes,
        mime_type: str,
        category: str = "pdf",
        is_public: bool = False,
    ) -> File:
        """Used by PDFService and other internal writers (no auth check)."""
        key = build_storage_key(owner_id=owner_id, category=category, filename=filename)
        bucket = settings.STORAGE_BUCKET
        stored = await self.storage.put(key=key, data=data, content_type=mime_type, bucket=bucket)
        f = await self.repo.create(
            owner_id=owner_id,
            bucket=stored.bucket,
            key=stored.key,
            original_name=safe_filename(filename),
            mime_type=mime_type,
            size_bytes=len(data),
            checksum=sha256_bytes(data),
            provider=settings.STORAGE_PROVIDER,
            is_public=is_public,
        )
        await self.db.flush()
        return f