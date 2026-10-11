from typing import Annotated, Optional
from fastapi import APIRouter, Depends, File as FastFile, Form, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.file import FileListOut, FileOut, FileWithUrlOut
from app.services.file_service import FileService
from app.services.storage import get_storage

router = APIRouter(prefix="/files", tags=["files"])


def _paginate(page: int, page_size: int, total: int) -> dict:
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


@router.post(
    "",
    response_model=FileWithUrlOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = FastFile(...),
    category: str = Form(default="document"),
    is_public: bool = Form(default=False),
):
    if not file.filename:
        raise ValidationError("Filename is required")
    data = await file.read()
    svc = FileService(db)
    f = await svc.upload(
        user,
        filename=file.filename,
        data=data,
        declared_content_type=file.content_type,
        category=category,
        is_public=is_public,
    )
    out = FileWithUrlOut.model_validate(f)
    out.url = await svc.url_for(f)
    return out


@router.get("", response_model=FileListOut)
async def list_files(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
):
    rows, total = await FileService(db).list_mine(user, page=page, page_size=page_size)
    return FileListOut(
        items=[FileOut.model_validate(r) for r in rows],
        **_paginate(page, page_size, total),
    )


@router.get("/{file_id}", response_model=FileWithUrlOut)
async def get_file_meta(
    file_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = FileService(db)
    f = await svc.get_for_viewer(user, file_id)
    out = FileWithUrlOut.model_validate(f)
    out.url = await svc.url_for(f)
    return out


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    f, data = await FileService(db).download(user, file_id)
    return Response(
        content=data,
        media_type=f.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{f.original_name}"',
            "X-File-Id": str(f.id),
        },
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await FileService(db).delete(user, file_id)


# -------- Raw serving for LocalStorage --------
@router.get("/raw/{bucket}/{key:path}")
async def raw_local_file(bucket: str, key: str):
    """
    Serves objects from LocalStorage. In production with STORAGE_PROVIDER=s3,
    clients should hit the presigned URL returned by `url_for` instead.
    """
    if settings.STORAGE_PROVIDER != "local":
        raise NotFoundError("Raw local serving disabled")
    storage = get_storage()
    if not await storage.exists(key=key, bucket=bucket):
        raise NotFoundError("File not found")
    data = await storage.get(key=key, bucket=bucket)
    return Response(content=data)