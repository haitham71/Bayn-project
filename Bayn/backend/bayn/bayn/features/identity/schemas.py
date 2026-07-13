"""
Pydantic schemas for the Identity feature.

models.py holds DB table shape; schemas.py holds API request/response shape.
Response schemas never include password_hash or other sensitive fields.
"""

import re
import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, ValidationInfo, field_validator, Field


from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import ExperienceRange


def _locale_from(info: ValidationInfo) -> str:
    """Pull locale from validation context; falls back if none was passed."""
    return (info.context or {}).get("locale", DEFAULT_LOCALE)


def _validate_saudi_phone(value: int, locale: str) -> int:
    phone = str(value).strip()

    if phone.startswith('+966'):
        raise ValueError(t("validation", "phone_prefix_plus966", locale))
    if phone.startswith('966'):
        raise ValueError(t("validation", "phone_prefix_966", locale))
    if phone.startswith('0'):
        raise ValueError(t("validation", "phone_leading_zero", locale))
    if not phone.isdigit():
        raise ValueError(t("validation", "phone_digits_only", locale))
    if not re.match(r"^5\d{8}$", phone):
        raise ValueError(t("validation", "phone_format", locale))

    return int(phone)


# Request Schemas

class UserSignup(BaseModel):
    first_name_ar: str
    second_name_ar: Optional[str] = None
    third_name_ar: Optional[str] = None
    last_name_ar: str
    birth_date: Optional[date] = None # lst change 7/7 لازم يكون فوق 18
    first_name_en: str
    second_name_en: Optional[str] = None
    third_name_en: Optional[str] = None
    last_name_en: str

    email: EmailStr
    username: str
    password: str

    phone_country_id: uuid.UUID
    phone_number: int

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str, info: ValidationInfo) -> str:
        if not re.match(r"^[a-zA-Z0-9_]{3,30}$", value):
            locale = _locale_from(info)
            raise ValueError(t("validation", "username_format", locale))
        return value.lower()

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: int, info: ValidationInfo) -> int:
        return _validate_saudi_phone(value, _locale_from(info))

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str, info: ValidationInfo) -> str:
        locale = _locale_from(info)
        if len(value) < 8:
            raise ValueError(t("validation", "password_min_length", locale))
        if not re.search(r"[A-Z]", value):
            raise ValueError(t("validation", "password_uppercase", locale))
        if not re.search(r"[a-z]", value):
            raise ValueError(t("validation", "password_lowercase", locale))
        if not re.search(r"\d", value):
            raise ValueError(t("validation", "password_number", locale))
        if not re.search(r"[@#$]", value):
            raise ValueError(t("validation", "password_special_char", locale))
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    """Partial update — only fields present in the request are changed."""
    second_name_ar: Optional[str] = None
    third_name_ar: Optional[str] = None
    second_name_en: Optional[str] = None
    third_name_en: Optional[str] = None
    country_id: Optional[uuid.UUID] = None
    city_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None
    years_of_experience: Optional[ExperienceRange] = None
    git_profile: Optional[str] = None
    industry_id: Optional[uuid.UUID] = None
    phone_country_id: Optional[uuid.UUID] = None
    phone_number: Optional[int] = None
    national_id: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)

    @field_validator("phone_number")
    @classmethod
    def validate_saudi_phone(cls, value: int | None, info: ValidationInfo) -> int | None:
        if value is None:
            return None
        return _validate_saudi_phone(value, _locale_from(info))


class OTPVerifyRequest(BaseModel):
    # No reference_id: Authentica v2 doesn't return one. The target
    # email/phone comes from the authenticated user, not this body.
    otp_code: str


class PendingOTPVerifyRequest(BaseModel):
    # pending_token carries the not-yet-persisted signup data — there's no
    # authenticated user yet for the target email/phone to come from.
    pending_token: str
    otp_code: str


class PendingResendRequest(BaseModel):
    pending_token: str



# Response Schemas

class CountryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name_en: str
    name_ar: str
    iso2: str
    dial_code: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID

    first_name_ar: str
    second_name_ar: Optional[str]
    third_name_ar: Optional[str]
    last_name_ar: str

    first_name_en: str
    second_name_en: Optional[str]
    third_name_en: Optional[str]
    last_name_en: str

    national_id: Optional[str]
    birth_date: Optional[date]

    email: str
    username: str

    phone_country_id: Optional[uuid.UUID]
    phone_number: Optional[int]

    country_id: Optional[uuid.UUID]
    city_id: Optional[uuid.UUID]
    job_title: Optional[str]
    years_of_experience: Optional[ExperienceRange]
    industry_id: Optional[uuid.UUID]
    git_profile: Optional[str]
    bio: Optional[str]

    avatar_url: Optional[str] = None

    role: str
    is_active: bool
    is_email_verified: bool
    is_number_verified: bool

    is_profile_complete: bool
    missing_profile_fields: list[str]

    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class OTPSendResponse(BaseModel):
    message: str


class PendingSignupResponse(BaseModel):
    pending_token: str
    message: str
    email_verified: bool
    phone_verified: bool


class MessageResponse(BaseModel):
    message: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    
class PasswordActionMessageResponse(BaseModel):
    message: str