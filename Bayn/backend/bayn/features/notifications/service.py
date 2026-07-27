"""Notifications service — create and read in-app notifications.

`create_notification` never commits: every caller is another feature's
service function creating a notification as a side effect of its own write
(a meeting request, an accept/reject, a task assignment...), so it shares
that caller's transaction and commit.
"""

import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import NotFoundError
from bayn.common.formatting import format_badge_count
from bayn.core.i18n import DEFAULT_LOCALE, localized_name, t
from bayn.features.notifications.models import Notification, NotificationType
from bayn.features.notifications.schemas import NotificationResponse, UnreadCountResponse


def create_notification(
    db: AsyncSession, user_id: uuid.UUID, type: NotificationType, data: dict | None = None
) -> Notification:
    notification = Notification(user_id=user_id, type=type, data=data or {})
    db.add(notification)
    return notification


def _render_message(notification: Notification, locale: str) -> str:
    data = notification.data
    actor_name = localized_name(data.get("actor_name_en", ""), data.get("actor_name_ar", ""), locale)
    return t(
        "notifications", f"message.{notification.type.value}", locale,
        actor_name=actor_name,
        project_title=data.get("project_title", ""),
        task_title=data.get("task_title", ""),
    )


def _uuid_or_none(value) -> uuid.UUID | None:
    """Tolerate bad id values in a notification's JSON data (e.g. the string
    'None' written before the row's id existed) instead of failing the response."""
    try:
        return uuid.UUID(str(value)) if value else None
    except (ValueError, TypeError, AttributeError):
        return None


def _to_response(notification: Notification, locale: str) -> NotificationResponse:
    data = notification.data
    return NotificationResponse(
        id=notification.id,
        type=notification.type,
        message=_render_message(notification, locale),
        is_read=notification.is_read,
        read_at=notification.read_at,
        created_at=notification.created_at,
        project_id=_uuid_or_none(data.get("project_id")),
        meeting_request_id=_uuid_or_none(data.get("meeting_request_id")),
        meeting_id=_uuid_or_none(data.get("meeting_id")),
        task_id=_uuid_or_none(data.get("task_id")),
    )


async def list_notifications(
    db: AsyncSession, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE, limit: int = 50, offset: int = 0
) -> list[NotificationResponse]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_to_response(n, locale) for n in result.scalars().all()]


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> UnreadCountResponse:
    count = await db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
    )
    return UnreadCountResponse(count=count, display=format_badge_count(count))


async def mark_read(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> NotificationResponse:
    notification = await db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    if not notification:
        raise NotFoundError(t("notifications", "errors.not_found", locale))

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = func.now()
        await db.commit()
        await db.refresh(notification)

    return _to_response(notification, locale)


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=func.now())
    )
    await db.commit()


async def delete_notification(
    db: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    # user_id filter keeps a user from deleting someone else's notification
    notification = await db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    if not notification:
        raise NotFoundError(t("notifications", "errors.not_found", locale))
    await db.delete(notification)
    await db.commit()


async def delete_all_notifications(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.commit()
