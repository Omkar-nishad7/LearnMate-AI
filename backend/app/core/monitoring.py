from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

from app.config.logging import get_logger
from app.config.settings import settings

logger = get_logger("monitoring")
_initialized = False


def init_sentry() -> None:
    global _initialized
    if _initialized:
        return
    if not settings.SENTRY_DSN:
        logger.info("sentry_disabled", reason="no_dsn")
        _initialized = True
        return

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        release="learnmate@0.1.0",
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            CeleryIntegration(),
        ],
        ignore_errors=[
            # expected client errors shouldn't spam Sentry
            "app.core.exceptions.ValidationError",
            "app.core.exceptions.NotFoundError",
            "app.core.exceptions.AuthenticationError",
            "app.core.exceptions.AuthorizationError",
        ],
    )
    logger.info("sentry_enabled", env=settings.ENVIRONMENT)
    _initialized = True