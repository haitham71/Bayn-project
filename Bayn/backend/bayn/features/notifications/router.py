"""Notifications router: list, unread count, mark read."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.notifications import service
from bayn.features.notifications.schemas import NotificationResponse, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse], summary="List my notifications")
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[NotificationResponse]:
    return await service.list_notifications(db, current_user.id, locale, limit, offset)


@router.get("/unread-count", response_model=UnreadCountResponse, summary="My unread notification count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    return await service.get_unread_count(db, current_user.id)


@router.put("/read-all", status_code=204, summary="Mark all my notifications read")
async def mark_all_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await service.mark_all_read(db, current_user.id)


@router.put("/{notification_id}/read", response_model=NotificationResponse, summary="Mark one notification read")
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> NotificationResponse:
    return await service.mark_read(db, current_user.id, notification_id, locale)


@router.delete("/{notification_id}", status_code=204, summary="Delete one notification")
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.delete_notification(db, current_user.id, notification_id, locale)


@router.delete("", status_code=204, summary="Clear all my notifications")
async def clear_notifications(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await service.delete_all_notifications(db, current_user.id)
