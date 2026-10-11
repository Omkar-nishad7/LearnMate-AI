# Celery workers will be added in Milestone 4+ (video & AI background jobs).
from app.workers.celery_app import celery_app

__all__ = ["celery_app"]