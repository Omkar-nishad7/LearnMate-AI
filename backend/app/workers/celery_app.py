from celery import Celery

from app.config.settings import settings

celery_app = Celery(
    "learnmate",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks.video_tasks",
        "app.workers.tasks.ai_tasks",
        "app.workers.tasks.pdf_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,
    task_soft_time_limit=540,
    worker_max_tasks_per_child=100,
    broker_connection_retry_on_startup=True,
    result_expires=3600,
)