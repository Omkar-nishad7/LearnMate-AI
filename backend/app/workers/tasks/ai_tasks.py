import asyncio

from celery import shared_task

from app.config.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.services.ai.notes_service import NotesAIService
from app.services.ai.quiz_service import QuizAIService
from app.services.ai.summary_service import SummaryService

logger = get_logger("worker.ai")


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
    except RuntimeError:
        pass
    return asyncio.run(coro)


async def _summary_async(user_id: int, video_id: int):
    async with AsyncSessionLocal() as db:
        return await SummaryService(db).generate_for_video(
            user_id=user_id, video_id=video_id
        )


async def _notes_async(user_id: int, video_id: int, course_id):
    async with AsyncSessionLocal() as db:
        note = await NotesAIService(db).generate_for_video(
            user_id=user_id, video_id=video_id, course_id=course_id
        )
        return {"note_id": note.id}


async def _quiz_async(user_id: int, video_id: int, num_questions: int, course_id):
    async with AsyncSessionLocal() as db:
        quiz = await QuizAIService(db).generate_for_video(
            user_id=user_id, video_id=video_id,
            num_questions=num_questions, course_id=course_id,
        )
        return {"quiz_id": quiz.id}


@shared_task(name="ai.summary", autoretry_for=(Exception,), max_retries=2, retry_backoff=True)
def generate_summary(user_id: int, video_id: int):
    return _run(_summary_async(user_id, video_id))


@shared_task(name="ai.notes", autoretry_for=(Exception,), max_retries=2, retry_backoff=True)
def generate_notes(user_id: int, video_id: int, course_id=None):
    return _run(_notes_async(user_id, video_id, course_id))


@shared_task(name="ai.quiz", autoretry_for=(Exception,), max_retries=2, retry_backoff=True)
def generate_quiz(user_id: int, video_id: int, num_questions: int = 5, course_id=None):
    return _run(_quiz_async(user_id, video_id, num_questions, course_id))