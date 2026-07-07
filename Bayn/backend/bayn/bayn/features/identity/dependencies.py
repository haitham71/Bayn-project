"""FastAPI auth dependencies — resolve the current user from a JWT."""

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ForbiddenError, InvalidTokenError
from bayn.core.database import get_db
from bayn.core.security import decode_token
from bayn.features.identity.models import User, UserRole
from bayn.features.identity.service import get_user_by_id

# reads "Authorization: Bearer <token>"; returns 401 automatically if absent
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        # expected_type="access" rejects a refresh token used here
        user_id = decode_token(token, expected_type="access")
    except jwt.PyJWTError:
        # wrap PyJWT errors so their internals never reach the client
        raise InvalidTokenError()

    return await get_user_by_id(db, user_id)


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    # kept separate from get_current_user so future endpoints (e.g. account
    # reactivation) can identify a user without requiring them to be active
    if not user.is_active:
        raise ForbiddenError("This account has been deactivated")
    return user


async def require_admin(
    user: User = Depends(get_current_active_user),
) -> User:
    # admin role is granted directly in the DB, never through the API
    if user.role != UserRole.admin:
        raise ForbiddenError("Admin access required")
    return user
