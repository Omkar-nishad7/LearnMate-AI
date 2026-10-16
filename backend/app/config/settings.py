from functools import lru_cache
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "LearnMate-AI"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost"

    # Security
    SECRET_KEY: str = Field(..., min_length=16)
    JWT_SECRET_KEY: str = Field(..., min_length=16)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Database
    DATABASE_URL: str
    DATABASE_SYNC_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    # Use the high-volume Flash-Lite model directly for student tutor chat.
    # Other AI features continue using GEMINI_MODEL.
    GEMINI_TUTOR_MODEL: str = "gemini-3.5-flash-lite"
    YOUTUBE_API_KEY: str = ""

    # Storage
    STORAGE_PROVIDER: str = "local"
    STORAGE_BUCKET: str = "learnmate"
    STORAGE_ACCESS_KEY: str = ""
    STORAGE_SECRET_KEY: str = ""
    STORAGE_ENDPOINT: str = ""
    STORAGE_REGION: str = "us-east-1"
    LOCAL_STORAGE_PATH: str = "./storage"
    MAX_VIDEO_UPLOAD_BYTES: int = 524288000  # 500 MB

    # SMTP
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@learnmate.ai"

    # AI Rate Limits
    AI_LIMIT_TUTOR_PER_DAY: int = 100
    AI_LIMIT_VIDEO_PER_DAY: int = 20
    AI_LIMIT_QUIZ_PER_DAY: int = 50
    AI_LIMIT_NOTES_PER_DAY: int = 50
    AI_LIMIT_TEACHER_PER_DAY: int = 200

    # Observability
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v



@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()