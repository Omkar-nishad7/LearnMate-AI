import asyncio
from io import BytesIO
from typing import BinaryIO, Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config.settings import settings
from app.core.exceptions import NotFoundError
from app.services.storage.base import StorageBackend, StoredObject


class S3Storage(StorageBackend):
    """
    Works with AWS S3, MinIO, Cloudflare R2, Backblaze B2, etc.
    All boto3 calls run in a thread executor to avoid blocking the event loop.
    """

    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.STORAGE_ENDPOINT or None,
            aws_access_key_id=settings.STORAGE_ACCESS_KEY,
            aws_secret_access_key=settings.STORAGE_SECRET_KEY,
            region_name=settings.STORAGE_REGION,
            config=BotoConfig(signature_version="s3v4", retries={"max_attempts": 3}),
        )

    async def _run(self, fn, *args, **kwargs):
        return await asyncio.to_thread(fn, *args, **kwargs)

    async def put(
        self, *, key: str, data: bytes,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None,
    ) -> StoredObject:
        bucket = bucket or settings.STORAGE_BUCKET
        await self._run(
            self.client.put_object,
            Bucket=bucket, Key=key, Body=data, ContentType=content_type,
        )
        return StoredObject(bucket=bucket, key=key, size=len(data), content_type=content_type)

    async def get(self, *, key: str, bucket: Optional[str] = None) -> bytes:
        bucket = bucket or settings.STORAGE_BUCKET
        try:
            resp = await self._run(self.client.get_object, Bucket=bucket, Key=key)
            return await self._run(resp["Body"].read)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
                raise NotFoundError("File not found in storage")
            raise

    async def stream(self, *, key: str, bucket: Optional[str] = None, chunk_size: int = 64 * 1024) -> BinaryIO:
        return BytesIO(await self.get(key=key, bucket=bucket))

    async def delete(self, *, key: str, bucket: Optional[str] = None) -> None:
        bucket = bucket or settings.STORAGE_BUCKET
        await self._run(self.client.delete_object, Bucket=bucket, Key=key)

    async def exists(self, *, key: str, bucket: Optional[str] = None) -> bool:
        bucket = bucket or settings.STORAGE_BUCKET
        try:
            await self._run(self.client.head_object, Bucket=bucket, Key=key)
            return True
        except ClientError:
            return False

    async def url_for(self, *, key: str, bucket: Optional[str] = None, expires_seconds: int = 3600) -> str:
        bucket = bucket or settings.STORAGE_BUCKET
        return await self._run(
            self.client.generate_presigned_url,
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )