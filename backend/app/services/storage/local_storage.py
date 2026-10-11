import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import BinaryIO, Optional

import aiofiles
import aiofiles.os

from app.config.settings import settings
from app.core.exceptions import NotFoundError
from app.services.storage.base import StorageBackend, StoredObject


class LocalStorage(StorageBackend):
    """
    Filesystem-backed storage. Useful for dev, single-node deployments,
    and CI. URL format: /api/v1/files/raw/{bucket}/{key} (served by the API).
    """

    def __init__(self, root: Optional[str] = None):
        self.root = Path(root or settings.LOCAL_STORAGE_PATH).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, bucket: str, key: str) -> Path:
        # Prevent path traversal
        full = (self.root / bucket / key).resolve()
        if not str(full).startswith(str(self.root)):
            raise NotFoundError("Invalid storage key")
        return full

    async def put(
        self, *, key: str, data: bytes,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None,
    ) -> StoredObject:
        bucket = bucket or settings.STORAGE_BUCKET
        path = self._path(bucket, key)
        await aiofiles.os.makedirs(path.parent, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        return StoredObject(bucket=bucket, key=key, size=len(data), content_type=content_type)

    async def get(self, *, key: str, bucket: Optional[str] = None) -> bytes:
        bucket = bucket or settings.STORAGE_BUCKET
        path = self._path(bucket, key)
        if not path.exists():
            raise NotFoundError("File not found in storage")
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def stream(self, *, key: str, bucket: Optional[str] = None, chunk_size: int = 64 * 1024) -> BinaryIO:
        return BytesIO(await self.get(key=key, bucket=bucket))

    async def delete(self, *, key: str, bucket: Optional[str] = None) -> None:
        bucket = bucket or settings.STORAGE_BUCKET
        path = self._path(bucket, key)
        if path.exists():
            await aiofiles.os.remove(path)

    async def exists(self, *, key: str, bucket: Optional[str] = None) -> bool:
        bucket = bucket or settings.STORAGE_BUCKET
        return self._path(bucket, key).exists()

    async def url_for(self, *, key: str, bucket: Optional[str] = None, expires_seconds: int = 3600) -> str:
        bucket = bucket or settings.STORAGE_BUCKET
        return f"/api/v1/files/raw/{bucket}/{key}"