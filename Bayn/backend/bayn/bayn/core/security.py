"""Password hashing (bcrypt) and JWT access/refresh tokens."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from passlib.context import CryptContext

from bayn.core.config import settings


# deprecated="auto" re-hashes on login if the scheme list changes later
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# "type" claim lets decode_token reject a refresh token used as an access token
TokenType = Literal["access", "refresh"]


def _create_token(
    user_id: uuid.UUID, token_type: TokenType, expires_delta: timedelta, jti: str | None = None
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    if jti is not None:
        payload["jti"] = jti
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: uuid.UUID, jti: str) -> str:
    # jti identifies this specific refresh token so it can be looked up and
    # revoked server-side (see RefreshToken model) — JWTs otherwise can't be
    # invalidated before they expire
    return _create_token(
        user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        jti=jti,
    )


def decode_token(token: str, expected_type: TokenType) -> uuid.UUID:
    # raises jwt.InvalidTokenError on expiry, bad signature, or wrong type
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Expected {expected_type} token, got {payload.get('type')}")

    return uuid.UUID(payload["sub"])


def decode_refresh_token(token: str) -> tuple[uuid.UUID, str]:
    # like decode_token, but also returns the jti so the caller can check it
    # against the RefreshToken table (revoked / already rotated / unknown)
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError(f"Expected refresh token, got {payload.get('type')}")

    jti = payload.get("jti")
    if not jti:
        raise jwt.InvalidTokenError("Refresh token missing jti")

    return uuid.UUID(payload["sub"]), jti
