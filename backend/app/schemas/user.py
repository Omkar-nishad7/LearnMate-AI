from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    organization: Optional[str] = None
    grade_level: Optional[str] = None
    timezone: str
    locale: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: UserRole
    status: UserStatus
    is_email_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    profile: Optional[UserProfileOut] = None


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    display_name: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=2000)
    phone: Optional[str] = Field(default=None, max_length=30)
    timezone: Optional[str] = Field(default=None, max_length=50)
    locale: Optional[str] = Field(default=None, max_length=10)
    organization: Optional[str] = Field(default=None, max_length=150)
    grade_level: Optional[str] = Field(default=None, max_length=50)