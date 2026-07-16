"""FastAPI auth dependencies — resolve the current user from a JWT."""

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ForbiddenError, IncompleteProfileError, InvalidTokenError
from bayn.core.database import get_db
from bayn.core.security import decode_token
from bayn.features.identity import service
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


async def require_complete_profile(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    # gates actions (e.g. booking a meeting) that need a fully filled-in profile
    skill_count = await service._count_user_skills(db, user.id)
    is_complete, _missing_fields = service._profile_completeness(user, skill_count)
    if not is_complete:
        raise IncompleteProfileError()
    return user
