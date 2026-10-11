from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotesExportIn(BaseModel):
    note_id: int
    background_task: bool = False


class QuizResultExportIn(BaseModel):
    attempt_id: int
    background_task: bool = False


class ExportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    file_id: int
    file_name: str
    size_bytes: int
    url: Optional[str] = None
    mime_type: str = "application/pdf"
    generated_at: datetime


class ExportTaskOut(BaseModel):
    task_id: str
    kind: str
    status: str = "PENDING"
    message: str = "Export queued. Check task status via /api/v1/exports/status/{task_id}."