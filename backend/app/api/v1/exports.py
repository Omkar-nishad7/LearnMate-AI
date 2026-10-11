from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.export import (
    ExportOut,
    ExportTaskOut,
    NotesExportIn,
    QuizResultExportIn,
)
from app.services.file_service import FileService
from app.services.pdf_service import PDFService
from app.workers.tasks.pdf_tasks import export_note_pdf_task, export_quiz_result_pdf_task

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("/notes", response_model=ExportOut, status_code=status.HTTP_201_CREATED)
async def export_note(
    payload: NotesExportIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.background_task:
        task = export_note_pdf_task.delay(user.id, payload.note_id)
        return ExportTaskOut(task_id=task.id, kind="note_pdf")

    svc = PDFService(db)
    file_id, name, size = await svc.export_note(user, payload.note_id)
    fs = FileService(db)
    f = await fs.get_for_viewer(user, file_id)
    return ExportOut(
        file_id=file_id,
        file_name=name,
        size_bytes=size,
        url=await fs.url_for(f),
        generated_at=f.created_at,
    )


@router.post("/quiz-results", response_model=ExportOut, status_code=status.HTTP_201_CREATED)
async def export_quiz_result(
    payload: QuizResultExportIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.background_task:
        task = export_quiz_result_pdf_task.delay(user.id, payload.attempt_id)
        return ExportTaskOut(task_id=task.id, kind="quiz_result_pdf")

    svc = PDFService(db)
    file_id, name, size = await svc.export_quiz_result(user, payload.attempt_id)
    fs = FileService(db)
    f = await fs.get_for_viewer(user, file_id)
    return ExportOut(
        file_id=file_id,
        file_name=name,
        size_bytes=size,
        url=await fs.url_for(f),
        generated_at=f.created_at,
    )