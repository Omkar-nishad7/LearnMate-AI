from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import BinaryIO, Optional


@dataclass
class StoredObject:
    bucket: str
    key: str
    size: int
    content_type: str


class StorageBackend(ABC):
    """Provider-agnostic storage contract."""

    @abstractmethod
    async def put(
        self,
        *,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None,
    ) -> StoredObject: ...

    @abstractmethod
    async def get(self, *, key: str, bucket: Optional[str] = None) -> bytes: ...

    @abstractmethod
    async def stream(
        self, *, key: str, bucket: Optional[str] = None, chunk_size: int = 64 * 1024
    ) -> BinaryIO: ...

    @abstractmethod
    async def delete(self, *, key: str, bucket: Optional[str] = None) -> None: ...

    @abstractmethod
    async def exists(self, *, key: str, bucket: Optional[str] = None) -> bool: ...

    @abstractmethod
    async def url_for(
        self, *, key: str, bucket: Optional[str] = None, expires_seconds: int = 3600
    ) -> str:
        """Return a URL the client can use to fetch the object (signed for S3)."""