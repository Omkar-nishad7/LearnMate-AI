import asyncio

from celery import shared_task

from app.config.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.pdf_service import PDFService

logger = get_logger("worker.pdf")


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
    except RuntimeError:
        pass
    return asyncio.run(coro)


async def _export_note_async(user_id: int, note_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        user = await UserRepository(db).get_by_id(user_id)
        if not user:
            raise RuntimeError("User not found")
        file_id, name, size = await PDFService(db).export_note(user, note_id)
        return {"file_id": file_id, "file_name": name, "size_bytes": size}


async def _export_quiz_async(user_id: int, attempt_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        user = await UserRepository(db).get_by_id(user_id)
        if not user:
            raise RuntimeError("User not found")
        file_id, name, size = await PDFService(db).export_quiz_result(user, attempt_id)
        return {"file_id": file_id, "file_name": name, "size_bytes": size}


@shared_task(name="pdf.notes", autoretry_for=(Exception,), max_retries=1, retry_backoff=True)
def export_note_pdf_task(user_id: int, note_id: int) -> dict:
    logger.info("pdf_notes_start", user_id=user_id, note_id=note_id)
    return _run(_export_note_async(user_id, note_id))


@shared_task(name="pdf.quiz_result", autoretry_for=(Exception,), max_retries=1, retry_backoff=True)
def export_quiz_result_pdf_task(user_id: int, attempt_id: int) -> dict:
    logger.info("pdf_quiz_result_start", user_id=user_id, attempt_id=attempt_id)
    return _run(_export_quiz_async(user_id, attempt_id))