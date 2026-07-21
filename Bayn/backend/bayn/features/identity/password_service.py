# Bayn/backend/bayn/bayn/features/identity/password_service.py

"""
Handles both password flows:
  - RESET  (forgot password, unauthenticated)
  - CHANGE (logged-in user, requires email confirmation)

Both share the same token mechanism: a high-entropy random token is
generated, only its HASH is stored in the database, and the raw token
goes out in the email link. If the DB ever leaks, stored hashes alone
are useless to an attacker.

All user-facing text (API error details, response messages, email
content) is pulled from locale JSON files via `t()` - see
bayn/core/i18n.py and bayn/locales/{en,ar}.json. No text should be
hardcoded directly in this file.
"""

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.config import settings
from bayn.core.i18n import t
from bayn.core.security import hash_password, verify_password
from bayn.features.identity.models import User, PasswordActionType
from bayn.features.identity.schemas import PasswordActionMessageResponse
from bayn.features.identity.service import revoke_all_refresh_tokens_for_user
from bayn.integrations.smtp import email_client


RESET_TOKEN_TTL_MINUTES = 30
CHANGE_TOKEN_TTL_MINUTES = 15  # shorter - user is already authenticated, less exposure needed

logger = logging.getLogger(__name__)


def _generate_raw_token() -> str:
    """32 bytes of cryptographically secure randomness, URL-safe encoded."""
    return secrets.token_urlsafe(32)


def _hash_token(raw_token: str) -> str:
    """
    SHA-256 is enough here (unlike password hashing, which needs bcrypt/argon2).
    The raw token already has ~256 bits of entropy, so brute-forcing it is
    infeasible regardless of hash speed - a slow hash would just waste CPU.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _constant_time_compare(a: str, b: str) -> bool:
    """
    Prevents timing attacks: `==` can leak how many leading characters
    matched based on comparison time. hmac.compare_digest always takes
    the same time regardless of where strings differ.
    """
    return hmac.compare_digest(a, b)



# RESET flow (forgot password - unauthenticated)

async def request_password_reset(
    db: AsyncSession, email: str, locale: str
) -> PasswordActionMessageResponse:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always return the same generic response, whether or not the user
    # exists - this prevents "user enumeration" attacks where an attacker
    # probes which emails are registered by checking for different replies.
    generic_message = t("identity", "password_reset.generic_message", locale=locale)

    if user is None:
        return PasswordActionMessageResponse(message=generic_message)

    raw_token = _generate_raw_token()
    user.password_action_token_hash = _hash_token(raw_token)
    user.password_action_type = PasswordActionType.RESET
    user.password_action_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_TTL_MINUTES
    )

    try:
        db.add(user)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

    # a delivery failure shouldn't 500 or change this response's contents
    try:
        await email_client.send_email(
            to=user.email,
            subject=t("identity", "password_reset.email_subject", locale=locale),
            body=t("identity", "password_reset.email_plain_text", locale=locale, link=reset_link),
            html_body=_build_reset_email_html(reset_link, locale),
        )
    except Exception:
        logger.exception("Failed to send password reset email to %s", user.email)

    return PasswordActionMessageResponse(message=generic_message)


async def confirm_password_reset(
    db: AsyncSession, token: str, new_password: str, locale: str
) -> PasswordActionMessageResponse:
    token_hash = _hash_token(token)

    # We fetch candidates with a pending token and compare hashes in Python
    # using constant-time comparison, rather than filtering by hash directly
    # in the SQL WHERE clause, to avoid any DB-level timing side channel.
    result = await db.execute(
        select(User).where(User.password_action_token_hash.is_not(None))
    )
    user = None
    for candidate in result.scalars().all():
        if _constant_time_compare(candidate.password_action_token_hash, token_hash):
            user = candidate
            break

    if user is None or user.password_action_type != PasswordActionType.RESET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_reset.invalid_or_expired", locale=locale),
        )

    if user.password_action_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_reset.expired", locale=locale),
        )

    # Don't let the reset re-use the current password. Checked before the token
    # is cleared so the same link can be retried with a different password.
    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_reset.same_as_current", locale=locale),
        )

    user.password_hash = hash_password(new_password)

    # Single-use only: clear the token immediately to prevent replay.
    user.password_action_token_hash = None
    user.password_action_type = None
    user.password_action_expires_at = None

    # Security best practice: after any password change, force all other
    # sessions/devices to log in again with the new password.
    await revoke_all_refresh_tokens_for_user(db, user.id)

    try:
        db.add(user)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

    return PasswordActionMessageResponse(message=t("identity", "password_reset.success", locale=locale))


# CHANGE flow (logged-in user, requires email confirmation)


async def request_password_change(
    db: AsyncSession, user: User, current_password: str, new_password: str, locale: str
) -> PasswordActionMessageResponse:
    # The user is already authenticated, so we verify their current password
    # upfront before even sending the confirmation email.
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_change.current_password_incorrect", locale=locale),
        )

    # The new password must actually be a change.
    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_change.same_as_current", locale=locale),
        )

    raw_token = _generate_raw_token()
    user.password_action_token_hash = _hash_token(raw_token)
    user.password_action_type = PasswordActionType.CHANGE
    user.password_action_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=CHANGE_TOKEN_TTL_MINUTES
    )
    # Stage the new password now - applied only once the link is confirmed.
    user.pending_password_hash = hash_password(new_password)

    try:
        db.add(user)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

    confirm_link = f"{settings.FRONTEND_URL}/confirm-password-change?token={raw_token}"

    try:
        await email_client.send_email(
            to=user.email,
            subject=t("identity", "password_change.email_subject", locale=locale),
            body=t("identity", "password_change.email_plain_text", locale=locale, link=confirm_link),
            html_body=_build_change_email_html(confirm_link, locale),
        )
    except Exception:
        logger.exception("Failed to send password change email to %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=t("identity", "password_change.send_failed", locale=locale),
        )

    return PasswordActionMessageResponse(
        message=t("identity", "password_change.request_sent", locale=locale)
    )


async def confirm_password_change(
    db: AsyncSession, token: str, locale: str
) -> PasswordActionMessageResponse:
    """
    Intentionally PUBLIC (no auth dependency) - the user clicks this link
    from their email client, which cannot attach an Authorization header.
    The token itself IS the proof of identity here.
    """
    token_hash = _hash_token(token)

    result = await db.execute(
        select(User).where(User.password_action_token_hash.is_not(None))
    )
    user = None
    for candidate in result.scalars().all():
        if _constant_time_compare(candidate.password_action_token_hash, token_hash):
            user = candidate
            break

    if user is None or user.password_action_type != PasswordActionType.CHANGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_change.invalid_or_expired", locale=locale),
        )

    if user.password_action_expires_at < datetime.now(timezone.utc):
        # Clean up stale pending password too, don't leave it hanging.
        user.password_action_token_hash = None
        user.password_action_type = None
        user.password_action_expires_at = None
        user.pending_password_hash = None
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=t("identity", "password_change.expired", locale=locale),
        )

    user.password_hash = user.pending_password_hash
    user.pending_password_hash = None
    user.password_action_token_hash = None
    user.password_action_type = None
    user.password_action_expires_at = None

    await revoke_all_refresh_tokens_for_user(db, user.id)

    try:
        db.add(user)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

    return PasswordActionMessageResponse(message=t("identity", "password_change.success", locale=locale))



# Email templates

def _build_reset_email_html(link: str, locale: str) -> str:
    """
    dir="rtl" vs "ltr" is a presentation concern (layout direction),
    separate from the translated text content itself - so it's handled
    here directly rather than via the locale JSON files.
    """
    is_rtl = locale == "ar"
    return f"""
    <div dir="{'rtl' if is_rtl else 'ltr'}" style="font-family: Arial, sans-serif;">
        <h2>{t('identity', 'password_reset.email_body_title', locale=locale)}</h2>
        <p>{t('identity', 'password_reset.email_body_text', locale=locale, minutes=RESET_TOKEN_TTL_MINUTES)}</p>
        <p>{t('identity', 'password_reset.email_body_ignore', locale=locale)}</p>
        <a href="{link}">{t('identity', 'password_reset.email_button', locale=locale)}</a>
    </div>
    """


def _build_change_email_html(link: str, locale: str) -> str:
    is_rtl = locale == "ar"
    return f"""
    <div dir="{'rtl' if is_rtl else 'ltr'}" style="font-family: Arial, sans-serif;">
        <h2>{t('identity', 'password_change.email_body_title', locale=locale)}</h2>
        <p>{t('identity', 'password_change.email_body_text', locale=locale)}</p>
        <a href="{link}">{t('identity', 'password_change.email_button', locale=locale)}</a>
    </div>
    """
