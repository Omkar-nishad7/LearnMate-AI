from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.config.logging import get_logger
from app.core.exceptions import AppError
from app.utils.responses import error_response

logger = get_logger("error_handler")


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        request_id = getattr(request.state, "request_id", None)
        logger.info(
            "app_error",
            request_id=request_id,
            code=exc.code,
            message=exc.message,
            status=exc.status_code,
        )
        return error_response(
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return error_response(
            code="HTTP_ERROR",
            message=str(exc.detail),
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return error_response(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            status_code=422,
            details=exc.errors(),
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        request_id = getattr(request.state, "request_id", None)
        logger.error("database_error", request_id=request_id, error=str(exc), exc_info=True)
        return error_response(
            code="DATABASE_ERROR",
            message="A database error occurred.",
            status_code=500,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None)
        logger.error("unhandled_error", request_id=request_id, error=str(exc), exc_info=True)
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
            status_code=500,
        )