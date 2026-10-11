from functools import lru_cache

from app.config.settings import settings
from app.core.exceptions import ValidationError
from app.services.storage.base import StorageBackend
from app.services.storage.local_storage import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    provider = (settings.STORAGE_PROVIDER or "local").lower()
    if provider == "local":
        return LocalStorage()
    if provider == "s3":
        # Import lazily to avoid requiring boto3 in local-only deployments
        from app.services.storage.s3_storage import S3Storage
        return S3Storage()
    raise ValidationError(f"Unknown STORAGE_PROVIDER: {provider}")