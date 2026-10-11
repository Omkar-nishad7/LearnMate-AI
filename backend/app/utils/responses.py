from typing import Any, Optional
from fastapi.responses import JSONResponse


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[Any] = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": code, "message": message, "details": details},
        },
    )


def success_response(
    data: Any = None,
    message: Optional[str] = None,
    status_code: int = 200,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data, "message": message},
    )