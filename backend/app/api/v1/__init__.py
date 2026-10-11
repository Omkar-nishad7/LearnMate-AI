
from fastapi import APIRouter

from app.api.v1 import (
    health,
    auth,
    videos,
    ai,
    teacher_ai,
    quizzes,
    assignments,
    progress,
    analytics,
    notifications,
    files,
    exports,
    notes,
    users,
    search,
    youtube_channels,
    teachers,
)
from app.api.v1.courses import (
    router as courses_router,
    teacher_router,
    student_router,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(courses_router)
api_router.include_router(teacher_router)
api_router.include_router(student_router)
api_router.include_router(videos.router)
api_router.include_router(ai.router)
api_router.include_router(teacher_ai.router)
api_router.include_router(quizzes.router)
api_router.include_router(assignments.router)
api_router.include_router(progress.router)
api_router.include_router(analytics.router)
api_router.include_router(notifications.router)
api_router.include_router(files.router)
api_router.include_router(exports.router)
api_router.include_router(notes.router)
api_router.include_router(search.router)
api_router.include_router(youtube_channels.router)
api_router.include_router(teachers.router)

__all__ = ["api_router"]
