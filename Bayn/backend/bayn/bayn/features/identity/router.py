"""Identity HTTP endpoints: auth, profile, avatar, OTP verification."""

import jwt
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import InvalidTokenError
from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.core.security import decode_token
from bayn.features.identity import service
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.identity.schemas import (
    MessageResponse,
    OTPSendResponse,
    OTPVerifyRequest,
    RefreshTokenRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    UserSignup,
    UserLogin,
)
from bayn.features.identity.service import _build_user_response

router = APIRouter(prefix="/auth", tags=["Identity"])


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=201, summary="إنشاء حساب جديد")
async def signup(
    payload: UserSignup,
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TokenResponse:
    return await service.create_user(db, payload, locale)


@router.post("/login", response_model=TokenResponse, summary="تسجيل الدخول")
async def login(
    payload: UserLogin,
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TokenResponse:
    return await service.authenticate_user(db, payload, locale)


@router.post("/refresh", response_model=TokenResponse, summary="تجديد الـ access token")
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TokenResponse:
    # decoded here, not in a dependency, because the deps expect an access token
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.PyJWTError:
        raise InvalidTokenError()

    return await service.refresh_access_token(db, user_id, locale)


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse, summary="جلب بيانات المستخدم الحالي")
async def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    return _build_user_response(current_user)


@router.patch("/me", response_model=UserResponse, summary="تحديث الملف الشخصي")
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    return await service.update_profile(db, current_user, payload)


@router.delete("/me", response_model=MessageResponse, summary="حذف الحساب (soft delete)")
async def delete_me(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await service.soft_delete_account(db, current_user)
    return MessageResponse(message="Account deleted successfully")


# ── Avatar ────────────────────────────────────────────────────────────────────

@router.post("/me/avatar", response_model=UserResponse, summary="رفع أو تحديث صورة الملف الشخصي")
async def upload_avatar(
    file: UploadFile = File(..., description="JPG / PNG / WebP, max 5MB"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserResponse:
    file_bytes = await file.read()
    return await service.upload_avatar(
        db=db,
        user=current_user,
        file_bytes=file_bytes,
        content_type=file.content_type or "",
        locale=locale,
    )


@router.delete("/me/avatar", response_model=UserResponse, summary="حذف صورة الملف الشخصي")
async def delete_avatar(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserResponse:
    return await service.delete_avatar(db, current_user, locale)


# ── Email OTP ─────────────────────────────────────────────────────────────────

@router.post("/verify-email/send", response_model=OTPSendResponse, summary="إرسال OTP للإيميل")
async def send_email_otp(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> OTPSendResponse:
    return await service.send_email_otp(db, current_user, locale)


@router.post("/verify-email/confirm", response_model=UserResponse, summary="تأكيد OTP الإيميل")
async def confirm_email_otp(
    payload: OTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserResponse:
    return await service.verify_email_otp(
        db=db, user=current_user, otp_code=payload.otp_code, locale=locale,
    )


# ── Phone OTP ─────────────────────────────────────────────────────────────────

@router.post("/verify-phone/send", response_model=OTPSendResponse, summary="إرسال OTP للهاتف")
async def send_phone_otp(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> OTPSendResponse:
    return await service.send_phone_otp(db, current_user, locale)


@router.post("/verify-phone/confirm", response_model=UserResponse, summary="تأكيد OTP الهاتف")
async def confirm_phone_otp(
    payload: OTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserResponse:
    return await service.verify_phone_otp(
        db=db, user=current_user, otp_code=payload.otp_code, locale=locale,
    )
