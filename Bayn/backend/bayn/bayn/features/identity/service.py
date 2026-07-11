"""Identity business logic — no HTTP concerns; raises exceptions the router maps to responses."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import (
    ConflictError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    NotFoundError,
    PhoneNotVerifiedError,
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
from bayn.features.catalog.models import UserSkill
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

# used to keep authenticate_user's timing constant for unknown emails
_DUMMY_PASSWORD_HASH = hash_password(str(uuid.uuid4()))

# fields a profile must have filled in, plus at least one skill, before it
# counts as "complete" (e.g. required to book a meeting)
_PROFILE_COMPLETENESS_FIELDS = (
    "second_name_ar", "third_name_ar", "second_name_en", "third_name_en",
    "national_id", "birth_date", "country_id", "city_id",
    "job_title", "industry_id", "years_of_experience",
    "avatar_key", "bio",
)
MAX_SKILLS_PER_USER = 7


async def _count_user_skills(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(UserSkill).where(UserSkill.user_id == user_id)
    )
    return result.scalar_one()


def _profile_completeness(user: User, skill_count: int) -> tuple[bool, list[str]]:
    missing = [field for field in _PROFILE_COMPLETENESS_FIELDS if not getattr(user, field)]
    if skill_count == 0:
        missing.append("skills")
    return not missing, missing


async def _build_user_response(db: AsyncSession, user: User) -> UserResponse:
    # avatar_url is derived from avatar_key here; the schema knows nothing about R2
    avatar_url = None
    if user.avatar_key:
        try:
            avatar_url = r2_client.get_avatar_url(user.avatar_key)
        except StorageError:
            # a broken URL shouldn't fail the whole response
            avatar_url = None

    skill_count = await _count_user_skills(db, user.id)
    is_complete, missing_fields = _profile_completeness(user, skill_count)

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
        birth_date=user.birth_date,
        email=user.email,
        username=user.username,
        phone_country_id=user.phone_country_id,
        phone_number=user.phone_number,
        country_id=user.country_id,
        city_id=user.city_id,
        job_title=user.job_title,
        years_of_experience=user.years_of_experience,
        industry_id=user.industry_id,
        git_profile=user.git_profile,
        bio=user.bio,
        avatar_url=avatar_url,
        role=user.role.value,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_number_verified=user.is_number_verified,
        is_profile_complete=is_complete,
        missing_profile_fields=missing_fields,
        created_at=user.created_at,
    )


async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=await _build_user_response(db, user),
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
        birth_date=payload.birth_date,
        username=payload.username,
        password_hash=hash_password(payload.password),
        phone_country_id=payload.phone_country_id,
        phone_number=payload.phone_number,
    )

    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # a concurrent signup slipped in between the checks above and this commit
        await db.rollback()
        raise UserAlreadyExistsError(t("identity", "auth.email_or_username_already_in_use", locale))
    await db.refresh(user)

    # kick off email verification automatically; signup still succeeds if the send fails
    # for any reason (rejected by Authentica, network error, timeout, ...)
    try:
        await send_email_otp(db, user, locale)
    except Exception:
        pass

    # signup logs the user straight in
    return await _issue_tokens(db, user)


async def authenticate_user(db: AsyncSession, payload: UserLogin, locale: str = DEFAULT_LOCALE) -> TokenResponse:
    user = await get_user_by_email(db, payload.email)

    # verify_password always runs, even for an unknown email, so response
    # timing can't be used to tell "no such user" from "wrong password"
    password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    password_ok = verify_password(payload.password, password_hash)

    # same error for wrong email and wrong password to prevent user enumeration
    if user is None or not password_ok:
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    if not user.is_active:
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    if not user.is_email_verified:
        raise EmailNotVerifiedError(t("identity", "auth.email_not_verified", locale))

    if not user.is_number_verified:
        raise PhoneNotVerifiedError(t("identity", "auth.phone_not_verified", locale))

    return await _issue_tokens(db, user)


async def refresh_access_token(db: AsyncSession, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> TokenResponse:
    # re-check the account: it may have been deleted/deactivated since the refresh token was issued
    user = await get_user_by_id(db, user_id, locale)

    if not user.is_active:
        raise InvalidCredentialsError(t("identity", "auth.invalid_credentials", locale))

    return await _issue_tokens(db, user)


# ── Profile ───────────────────────────────────────────────────────────────────

async def update_profile(
    db: AsyncSession, user: User, payload: UpdateProfileRequest, locale: str = DEFAULT_LOCALE
) -> UserResponse:
    # exclude_unset so only the fields the user actually sent get updated
    updates = payload.model_dump(exclude_unset=True)

    # changing the phone number/country invalidates the prior OTP verification
    phone_changed = any(
        field in updates and updates[field] != getattr(user, field)
        for field in ("phone_number", "phone_country_id")
    )

    for field, value in updates.items():
        setattr(user, field, value)
    if phone_changed:
        user.is_number_verified = False

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ConflictError(t("identity", "profile.national_id_already_in_use", locale))
    await db.refresh(user)
    return await _build_user_response(db, user)


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
    return await _build_user_response(db, user)


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
    return await _build_user_response(db, user)


# ── OTP ───────────────────────────────────────────────────────────────────────

_OTP_RATE_LIMIT = 3
_OTP_RATE_LIMIT_WINDOW = timedelta(hours=24)


async def _check_otp_rate_limit(
    db: AsyncSession, user_id: uuid.UUID, channel: OTPChannel, locale: str
) -> None:
    result = await db.execute(
        select(func.count()).select_from(AuthenticaOTPLog).where(
            AuthenticaOTPLog.user_id == user_id,
            AuthenticaOTPLog.channel == channel,
            AuthenticaOTPLog.sent_at >= datetime.now(timezone.utc) - _OTP_RATE_LIMIT_WINDOW,
        )
    )
    if result.scalar_one() >= _OTP_RATE_LIMIT:
        raise ValidationError(t("identity", "otp.rate_limit_exceeded", locale))


async def send_email_otp(db: AsyncSession, user: User, locale: str = DEFAULT_LOCALE) -> OTPSendResponse:
    if user.is_email_verified:
        raise ValidationError(t("identity", "otp.email_already_verified", locale))

    await _check_otp_rate_limit(db, user.id, OTPChannel.email, locale)

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

    # chain straight into phone verification; a failed send doesn't undo the email confirmation
    if user.phone_number and user.phone_country_id:
        try:
            phone_user = await get_user_by_id(db, user.id, locale)
            await send_phone_otp(db, phone_user, locale)
        except Exception:
            pass

    return await _build_user_response(db, user)


async def send_phone_otp(db: AsyncSession, user: User, locale: str = DEFAULT_LOCALE) -> OTPSendResponse:
    if user.is_number_verified:
        raise ValidationError(t("identity", "otp.phone_already_verified", locale))

    if not user.phone_number or not user.phone_country_id:
        raise ValidationError(t("identity", "otp.phone_country_required", locale))

    # relationship must be loaded to read dial_code
    if not user.phone_country:
        raise ValidationError(t("identity", "otp.phone_country_not_found", locale))

    await _check_otp_rate_limit(db, user.id, OTPChannel.sms, locale)

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
    return await _build_user_response(db, user)
