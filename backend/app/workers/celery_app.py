
from celery import Celery

from app.config.settings import settings

redis_url = settings.REDIS_URL

# Configure TLS certificate verification for Celery's Redis connections.
if redis_url.startswith("rediss://"):
    separator = "&" if "?" in redis_url else "?"
    celery_redis_url = f"{redis_url}{separator}ssl_cert_reqs=required"
else:
    celery_redis_url = redis_url

celery_app = Celery(
    "learnmate",
    broker=celery_redis_url,
    backend=celery_redis_url,
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
