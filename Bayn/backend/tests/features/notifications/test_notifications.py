"""Notifications feature tests: listing, unread count (with the "9+" badge
cap), and marking read — the create-side wiring (meeting/task events) is
covered in each of those features' own test files."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from bayn.core.security import create_access_token
from bayn.features.identity.models import User
from bayn.features.notifications import service
from bayn.features.notifications.models import NotificationType


def auth_headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


class TestListNotifications:

    @pytest.mark.asyncio
    async def test_empty_by_default(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/notifications", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_lists_own_notifications_newest_first(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        first = service.create_notification(
            db, test_user.id, NotificationType.task_assigned,
            {"actor_name_en": "Alice", "actor_name_ar": "أليس", "task_title": "First"},
        )
        second = service.create_notification(
            db, test_user.id, NotificationType.task_assigned,
            {"actor_name_en": "Bob", "actor_name_ar": "بوب", "task_title": "Second"},
        )
        await db.commit()
        # SQLite's server_default now() is second-granular — force distinct
        # timestamps so ordering is deterministic in this test.
        first.created_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        second.created_at = datetime.now(timezone.utc)
        await db.commit()

        response = await client.get("/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["message"] == "Bob assigned you a task: Second"
        assert data[1]["message"] == "Alice assigned you a task: First"
        assert all(n["is_read"] is False for n in data)

    @pytest.mark.asyncio
    async def test_message_is_localized_by_locale(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        service.create_notification(
            db, test_user.id, NotificationType.task_assigned,
            {"actor_name_en": "Alice", "actor_name_ar": "أليس", "task_title": "Spec"},
        )
        await db.commit()

        response = await client.get(
            "/notifications", headers={**auth_headers, "Accept-Language": "ar"}
        )
        assert response.status_code == 200
        assert response.json()[0]["message"] == "أليس كلّفك بمهمة: Spec"

    @pytest.mark.asyncio
    async def test_does_not_leak_another_users_notifications(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict, other_user: User,
    ):
        service.create_notification(
            db, other_user.id, NotificationType.task_assigned,
            {"actor_name_en": "Alice", "actor_name_ar": "أليس", "task_title": "Not yours"},
        )
        await db.commit()

        response = await client.get("/notifications", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []


class TestUnreadCount:

    @pytest.mark.asyncio
    async def test_zero_by_default(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/notifications/unread-count", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == {"count": 0, "display": "0"}

    @pytest.mark.asyncio
    async def test_counts_only_unread(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        for _ in range(3):
            service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        read_one = service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        await db.commit()
        read_one.is_read = True
        await db.commit()

        response = await client.get("/notifications/unread-count", headers=auth_headers)
        assert response.json() == {"count": 3, "display": "3"}

    @pytest.mark.asyncio
    async def test_caps_display_at_nine_plus(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        for _ in range(12):
            service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.get("/notifications/unread-count", headers=auth_headers)
        data = response.json()
        assert data["count"] == 12
        assert data["display"] == "9+"

    @pytest.mark.asyncio
    async def test_nine_exactly_shows_nine_not_plus(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        for _ in range(9):
            service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.get("/notifications/unread-count", headers=auth_headers)
        assert response.json()["display"] == "9"


class TestMarkRead:

    @pytest.mark.asyncio
    async def test_mark_one_read(self, client: AsyncClient, db, test_user: User, auth_headers: dict):
        notification = service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.put(f"/notifications/{notification.id}/read", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_read"] is True
        assert response.json()["read_at"] is not None

        count = await client.get("/notifications/unread-count", headers=auth_headers)
        assert count.json()["count"] == 0

    @pytest.mark.asyncio
    async def test_cannot_mark_another_users_notification_read(
        self, client: AsyncClient, db, auth_headers: dict, other_user: User,
    ):
        notification = service.create_notification(db, other_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.put(f"/notifications/{notification.id}/read", headers=auth_headers)
        assert response.status_code == 404


class TestMarkAllRead:

    @pytest.mark.asyncio
    async def test_marks_all_own_unread_notifications_read(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict,
    ):
        service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        service.create_notification(db, test_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.put("/notifications/read-all", headers=auth_headers)
        assert response.status_code == 204

        rows = (await client.get("/notifications", headers=auth_headers)).json()
        assert all(n["is_read"] is True and n["read_at"] is not None for n in rows)

        count = await client.get("/notifications/unread-count", headers=auth_headers)
        assert count.json()["count"] == 0

    @pytest.mark.asyncio
    async def test_does_not_affect_another_users_notifications(
        self, client: AsyncClient, db, auth_headers: dict, other_user: User,
    ):
        other_notification = service.create_notification(db, other_user.id, NotificationType.task_assigned, {})
        await db.commit()

        response = await client.put("/notifications/read-all", headers=auth_headers)
        assert response.status_code == 204

        await db.refresh(other_notification)
        assert other_notification.is_read is False
