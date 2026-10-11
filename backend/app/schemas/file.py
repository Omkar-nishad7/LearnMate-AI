from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    bucket: str
    key: str
    original_name: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    checksum: Optional[str] = None
    provider: str
    is_public: bool
    created_at: datetime


class FileWithUrlOut(FileOut):
    url: Optional[str] = None


class FileListOut(BaseModel):
    items: list[FileOut]
    total: int
    page: int
    page_size: int
    pages: int


class UploadCategory(BaseModel):
    """Not used directly; documented for OpenAPI completeness."""
    pass