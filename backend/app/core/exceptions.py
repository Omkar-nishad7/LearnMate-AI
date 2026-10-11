from typing import Any, Optional


class AppError(Exception):
    """Base application error. Handled centrally in middleware."""

    code: str = "APP_ERROR"
    status_code: int = 400
    message: str = "Application error"

    def __init__(
        self,
        message: Optional[str] = None,
        *,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Any] = None,
    ):
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details
        super().__init__(self.message)


class ValidationError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "Validation error"


class AuthenticationError(AppError):
    code = "AUTHENTICATION_ERROR"
    status_code = 401
    message = "Authentication failed"


class InvalidCredentialsError(AuthenticationError):
    code = "INVALID_CREDENTIALS"
    message = "Invalid email or password"


class TokenExpiredError(AuthenticationError):
    code = "TOKEN_EXPIRED"
    message = "Token has expired"


class TokenInvalidError(AuthenticationError):
    code = "TOKEN_INVALID"
    message = "Token is invalid"


class RefreshTokenReuseError(AuthenticationError):
    code = "REFRESH_TOKEN_REUSE"
    message = "Refresh token reuse detected; session revoked"


class AuthorizationError(AppError):
    code = "AUTHORIZATION_ERROR"
    status_code = 403
    message = "You do not have permission to perform this action"


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404
    message = "Resource not found"


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409
    message = "Resource conflict"


class RateLimitError(AppError):
    code = "RATE_LIMITED"
    status_code = 429
    message = "Too many requests. Please try again later."


class AccountNotActiveError(AuthenticationError):
    code = "ACCOUNT_NOT_ACTIVE"
    message = "Account is not active"