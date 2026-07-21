"""Chat unread-message tracking: the unread-count badge and marking a
conversation read. Messages are sent over the WebSocket in the real app —
tests drive that path through the service layer directly since there's no
REST endpoint for it."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from bayn.features.chat import service as chat_service


@pytest.mark.asyncio
async def test_unread_count_zero_with_no_conversations(client: AsyncClient, auth_headers: dict):
    response = await client.get("/chats/unread-count", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"count": 0, "display": "0"}


@pytest.mark.asyncio
async def test_unread_count_counts_others_messages_not_your_own(
    client: AsyncClient, db, test_user, other_user, auth_headers: dict
):
    create = await client.post(
        "/chats/direct", headers=auth_headers, json={"recipient_id": str(other_user.id)}
    )
    conversation_id = uuid.UUID(create.json()["id"])

    await chat_service.save_message(db, conversation_id, other_user.id, "hi there")
    await chat_service.save_message(db, conversation_id, test_user.id, "hi back")  # own message

    response = await client.get("/chats/unread-count", headers=auth_headers)
    assert response.json() == {"count": 1, "display": "1"}


@pytest.mark.asyncio
async def test_marking_conversation_read_clears_its_unread_count(
    client: AsyncClient, db, test_user, other_user, auth_headers: dict
):
    create = await client.post(
        "/chats/direct", headers=auth_headers, json={"recipient_id": str(other_user.id)}
    )
    conversation_id = uuid.UUID(create.json()["id"])
    await chat_service.save_message(db, conversation_id, other_user.id, "hi there")

    read = await client.post(f"/chats/{conversation_id}/read", headers=auth_headers)
    assert read.status_code == 204

    response = await client.get("/chats/unread-count", headers=auth_headers)
    assert response.json()["count"] == 0

    # a message sent *after* the read still counts — SQLite's server_default
    # now() is only second-granular, so nudge it forward to make the
    # ordering deterministic against the Python-side last_read_at timestamp.
    sent = await chat_service.save_message(db, conversation_id, other_user.id, "you there?")
    from bayn.features.chat.models import Message
    message = await db.get(Message, sent.id)
    message.created_at = datetime.now(timezone.utc) + timedelta(seconds=5)
    await db.commit()

    response = await client.get("/chats/unread-count", headers=auth_headers)
    assert response.json()["count"] == 1


@pytest.mark.asyncio
async def test_unread_count_caps_display_at_nine_plus(
    client: AsyncClient, db, test_user, other_user, auth_headers: dict
):
    create = await client.post(
        "/chats/direct", headers=auth_headers, json={"recipient_id": str(other_user.id)}
    )
    conversation_id = uuid.UUID(create.json()["id"])

    for i in range(12):
        await chat_service.save_message(db, conversation_id, other_user.id, f"msg {i}")

    response = await client.get("/chats/unread-count", headers=auth_headers)
    data = response.json()
    assert data["count"] == 12
    assert data["display"] == "9+"


@pytest.mark.asyncio
async def test_cannot_mark_a_conversation_read_you_are_not_in(
    client: AsyncClient, other_user, auth_headers: dict
):
    response = await client.post(f"/chats/{uuid.uuid4()}/read", headers=auth_headers)
    assert response.status_code == 404
