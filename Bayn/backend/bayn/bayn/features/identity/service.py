"""Identity business logic — no HTTP concerns; raises exceptions the router maps to responses."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import (
    InvalidCredentialsError,
    NotFoundError,
    UserAlreadyExistsError,
    ValidationError,
)
from bayn.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import AuthenticaOTPLog, OTPChannel, OTPStatus, User
from bayn.features.identity.schemas import (
    OTPSendResponse,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    UserSignup,
    UserLogin,
)
from bayn.integrations.authentica import AuthenticaError, AuthenticaOTPInvalid, authentica_client
from bayn.integrations.storage.cloudflare import InvalidFileError, StorageError, r2_client


def _build_user_response(user: User) -> UserResponse:
    # avatar_url is derived from avatar_key here; the schema knows nothing about R2
    avatar_url = None
    if user.avatar_key:
        try:
            avatar_url = r2_client.get_avatar_url(user.avatar_key)
        except StorageError:
            # a broken URL shouldn't fail the whole response
            avatar_url = None

    return UserResponse(
        id=user.id,
        first_name_ar=user.first_name_ar,
        second_name_ar=user.second_name_ar,
        third_name_ar=user.third_name_ar,
        last_name_ar=user.last_name_ar,
        first_name_en=user.first_name_en,
        second_name_en=user.second_name_en,
        third_name_en=user.third_name_en,
        last_name_en=user.last_name_en,
        national_id=user.national_id,
        email=user.email,
        username=user.username,
        phone_country_id=user.phone_country_id,
        phone_number=user.phone_number,
        city=user.city,
        industry_id=user.industry_id,
        git_profile=user.git_profile,
        avatar_url=avatar_url,
        role=user.role.value,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_number_verified=user.is_number_verified,
        created_at=user.created_at,
    )


def _issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=_build_user_response(user),
    )


# ── Queries ───────────────────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.email == email, User.deleted_at.is_(None))
        .options(selectinload(User.phone_country))
    )
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(
        select(User).where(User.username == username, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> User:
    # raises instead of returning None: used by the auth dependency where a
    # missing user means the token points at a deleted account
    result = await db.execute(
        select(User)
        .where(User.id == user_id, User.deleted_at.is_(None))
        .options(selectinload(User.phone_country))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(t("identity", "auth.user_not_found", locale))
    return user


# ── Auth ──────────────────────────────────────────────────────────────────────

async def create_user(db: AsyncSession, payload: UserSignup, locale: str = DEFAULT_LOCALE) -> TokenResponse:
    # check uniqueness up front for clear errors instead of a raw IntegrityError
    if await get_user_by_email(db, payload.email):
        raise UserAlreadyExistsError(t("identity", "auth.email_already_in_use", locale))
    if await get_user_by_username(db, payload.username):
        raise UserAlreadyExistsError(t("identity", "auth.username_already_in_use", locale))

    user = User(
        first_name_ar=payload.first_name_ar,
        second_name_ar=payload.second_name_ar,
        third_name_ar=payload.third_name_ar,
        last_name_ar=payload.last_name_ar,
        first_name_en=payload.first_name_en,
        second_name_en=payload.second_name_en,
        third_name_en=payload.third_name_en,
        last_name_en=payload.last_name_en,
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        phone_country_id=payload.phone_country_id,
        phone_number=payload.phone_number,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # signup logs the user straight in
    return _issue_tokens(user)


async def authenticate_user(db: AsyncSession, payload: UserLogin, locale: str = DEFAULT_LOCALE) -> TokenResponse:
    user = await get_user_by_email(db, payload.email)

    # same error for wrong email and wrong password to prevent user enumeration
    if user is None or not verify_password(payload.password, user.password_hash):
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    if not user.is_active:
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    return _issue_tokens(user)


async def refresh_access_token(db: AsyncSession, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> TokenResponse:
    # re-check the account: it may have been deleted/deactivated since the refresh token was issued
    user = await get_user_by_id(db, user_id, locale)

    if not user.is_active:
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    return _issue_tokens(user)


# ── Profile ───────────────────────────────────────────────────────────────────

async def update_profile(db: AsyncSession, user: User, payload: UpdateProfileRequest) -> UserResponse:
    # exclude_unset so only the fields the user actually sent get updated
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return _build_user_response(user)


async def soft_delete_account(db: AsyncSession, user: User) -> None:
    # keep the row for audit; queries filter on deleted_at IS NULL
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.commit()


# ── Avatar ────────────────────────────────────────────────────────────────────

async def upload_avatar(
    db: AsyncSession,
    user: User,
    file_bytes: bytes,
    content_type: str,
    locale: str = DEFAULT_LOCALE,
) -> UserResponse:
    # upload the new image first: if it fails, the old one is still intact
    try:
        new_avatar_key = r2_client.upload_avatar(user.id, file_bytes, content_type)
    except InvalidFileError as e:
        raise ValidationError(e.message)
    except StorageError:
        raise ValidationError(t("identity", "avatar.upload_failed", locale))

    # delete the old image after; if this fails we keep the new one anyway
    if user.avatar_key and user.avatar_key != new_avatar_key:
        try:
            r2_client.delete_avatar(user.avatar_key)
        except StorageError:
            pass

    user.avatar_key = new_avatar_key
    await db.commit()
    await db.refresh(user)
    return _build_user_response(user)


async def delete_avatar(db: AsyncSession, user: User, locale: str = DEFAULT_LOCALE) -> UserResponse:
    if not user.avatar_key:
        raise ValidationError(t("identity", "avatar.no_avatar_to_delete", locale))

    try:
        r2_client.delete_avatar(user.avatar_key)
    except StorageError:
        raise ValidationError(t("identity", "avatar.delete_failed", locale))

    user.avatar_key = None
    await db.commit()
    await db.refresh(user)
    return _build_user_response(user)


# ── OTP ───────────────────────────────────────────────────────────────────────

async def send_email_otp(db: AsyncSession, user: User, locale: str = DEFAULT_LOCALE) -> OTPSendResponse:
    if user.is_email_verified:
        raise ValidationError(t("identity", "otp.email_already_verified", locale))

    try:
        await authentica_client.send_email_otp(user.email)
    except AuthenticaError:
        raise ValidationError(t("identity", "otp.send_failed", locale))

    # reference_id is "n/a" — Authentica v2 doesn't return one; log kept for audit
    db.add(AuthenticaOTPLog(
        user_id=user.id,
        channel=OTPChannel.email,
        reference_id="n/a",
        status=OTPStatus.sent,
    ))
    await db.commit()
    return OTPSendResponse(message=t("identity", "otp.sent_email", locale))


async def verify_email_otp(db: AsyncSession, user: User, otp_code: str, locale: str = DEFAULT_LOCALE) -> UserResponse:
    # grab the most recent pending email OTP to mark it verified
    result = await db.execute(
        select(AuthenticaOTPLog).where(
            AuthenticaOTPLog.user_id == user.id,
            AuthenticaOTPLog.channel == OTPChannel.email,
            AuthenticaOTPLog.status == OTPStatus.sent,
        ).order_by(AuthenticaOTPLog.sent_at.desc()).limit(1)
    )
    otp_log = result.scalar_one_or_none()
    if otp_log is None:
        raise ValidationError(t("identity", "otp.no_pending_otp", locale))

    try:
        await authentica_client.verify_email_otp(user.email, otp_code)
    except AuthenticaOTPInvalid:
        raise ValidationError(t("identity", "otp.invalid_code", locale))
    except AuthenticaError:
        raise ValidationError(t("identity", "otp.verification_failed", locale))

    otp_log.status = OTPStatus.verified
    otp_log.verified_at = datetime.now(timezone.utc)
    user.is_email_verified = True

    await db.commit()
    await db.refresh(user)
    return _build_user_response(user)


async def send_phone_otp(db: AsyncSession, user: User, locale: str = DEFAULT_LOCALE) -> OTPSendResponse:
    if user.is_number_verified:
        raise ValidationError(t("identity", "otp.phone_already_verified", locale))

    if not user.phone_number or not user.phone_country_id:
        raise ValidationError(t("identity", "otp.phone_country_required", locale))

    # relationship must be loaded to read dial_code
    if not user.phone_country:
        raise ValidationError(t("identity", "otp.phone_country_not_found", locale))

    try:
        await authentica_client.send_sms_otp(
            dial_code=user.phone_country.dial_code,
            phone_number=user.phone_number,
        )
    except AuthenticaError:
        raise ValidationError(t("identity", "otp.send_failed", locale))

    db.add(AuthenticaOTPLog(
        user_id=user.id,
        channel=OTPChannel.sms,
        reference_id="n/a",
        status=OTPStatus.sent,
    ))
    await db.commit()
    return OTPSendResponse(message=t("identity", "otp.sent_phone", locale))


async def verify_phone_otp(db: AsyncSession, user: User, otp_code: str, locale: str = DEFAULT_LOCALE) -> UserResponse:
    if not user.phone_number or not user.phone_country:
        raise ValidationError(t("identity", "otp.phone_not_set", locale))

    result = await db.execute(
        select(AuthenticaOTPLog).where(
            AuthenticaOTPLog.user_id == user.id,
            AuthenticaOTPLog.channel == OTPChannel.sms,
            AuthenticaOTPLog.status == OTPStatus.sent,
        ).order_by(AuthenticaOTPLog.sent_at.desc()).limit(1)
    )
    otp_log = result.scalar_one_or_none()
    if otp_log is None:
        raise ValidationError(t("identity", "otp.no_pending_otp", locale))

    try:
        await authentica_client.verify_sms_otp(
            dial_code=user.phone_country.dial_code,
            phone_number=user.phone_number,
            otp_code=otp_code,
        )
    except AuthenticaOTPInvalid:
        raise ValidationError(t("identity", "otp.invalid_code", locale))
    except AuthenticaError:
        raise ValidationError(t("identity", "otp.verification_failed", locale))

    otp_log.status = OTPStatus.verified
    otp_log.verified_at = datetime.now(timezone.utc)
    user.is_number_verified = True

    await db.commit()
    await db.refresh(user)
    return _build_user_response(user)
