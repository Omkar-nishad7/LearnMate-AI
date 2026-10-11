from app.core.exceptions import AppError


class AIError(AppError):
    code = "AI_ERROR"
    status_code = 502
    message = "AI service error"


class AIUnavailableError(AIError):
    code = "AI_UNAVAILABLE"
    message = "AI service is currently unavailable"


class AITimeoutError(AIError):
    code = "AI_TIMEOUT"
    status_code = 504
    message = "AI service timed out"


class AIInvalidOutputError(AIError):
    code = "AI_INVALID_OUTPUT"
    message = "AI returned an invalid response"


class AIRateLimitedError(AppError):
    code = "AI_RATE_LIMITED"
    status_code = 429
    message = "AI usage limit reached. Try again later."


class AINotConfiguredError(AIError):
    code = "AI_NOT_CONFIGURED"
    status_code = 503
    message = "AI is not configured on this server"