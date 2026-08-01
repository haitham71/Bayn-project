"""Comprehensive async test suite for the Bayn Chat module."""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from bayn.common.exceptions import NotFoundError, ValidationError
from bayn.core.security import create_access_token
from bayn.features.identity.models import User
from bayn.features.chat.models import Message, message_mentions
from bayn.features.chat import service
from bayn.features.chat.manager import ConnectionManager


def auth_headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ── Fixtures & Setup ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user_a(db: AsyncSession) -> User:
    """Creates primary test user A."""
    user = User(
        id=uuid.uuid4(),
        username="user_a",
        email="user_a@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        first_name_ar="علي",
        last_name_ar="أحمد",
        first_name_en="Ali",
        last_name_en="Ahmed",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_b(db: AsyncSession) -> User:
    """Creates secondary test user B."""
    user = User(
        id=uuid.uuid4(),
        username="user_b",
        email="user_b@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        first_name_ar="سارة",
        last_name_ar="محمد",
        first_name_en="Sara",
        last_name_en="Mohammed",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_c(db: AsyncSession) -> User:
    """Creates tertiary test user C (outsider user)."""
    user = User(
        id=uuid.uuid4(),
        username="user_c",
        email="user_c@example.com",
        password_hash="test_hash",
        birth_date=date(2000, 1, 1),
        first_name_ar="خالد",
        last_name_ar="العتيبي",
        first_name_en="Khaled",
        last_name_en="Al-Otaibi",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def direct_conversation(
    db: AsyncSession, user_a: User, user_b: User
):
    """Initializes a direct 1-on-1 conversation between User A and User B."""
    return await service.get_or_create_direct_conversation(
        db, user_a_id=user_a.id, user_b_id=user_b.id
    )


# ── Service Layer Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_or_create_direct_conversation_new(
    db: AsyncSession, user_a: User, user_b: User
):
    """Tests creating a brand-new direct chat between two users."""
    conv_resp = await service.get_or_create_direct_conversation(
        db, user_a_id=user_a.id, user_b_id=user_b.id
    )
    assert conv_resp.id is not None
    assert len(conv_resp.members) == 2
    
    member_ids = {m.user_id for m in conv_resp.members}
    assert member_ids == {user_a.id, user_b.id}


@pytest.mark.asyncio
async def test_get_or_create_direct_conversation_idempotent(
    db: AsyncSession, user_a: User, user_b: User
):
    """Ensures repeated calls return the same existing conversation ID instead of creating duplicates."""
    conv_1 = await service.get_or_create_direct_conversation(
        db, user_a_id=user_a.id, user_b_id=user_b.id
    )
    conv_2 = await service.get_or_create_direct_conversation(
        db, user_a_id=user_b.id, user_b_id=user_a.id
    )
    assert conv_1.id == conv_2.id


@pytest.mark.asyncio
async def test_cannot_chat_with_self(db: AsyncSession, user_a: User):
    """Verifies that starting a chat with oneself throws a ValidationError."""
    with pytest.raises(ValidationError):
        await service.get_or_create_direct_conversation(
            db, user_a_id=user_a.id, user_b_id=user_a.id
        )


@pytest.mark.asyncio
async def test_save_message_with_mentions(
    db: AsyncSession, user_a: User, user_b: User, direct_conversation
):
    """Verifies saving a message with @mentions and checking database state."""
    msg_content = "Hey @user_b check this architecture!"
    
    msg_resp = await service.save_message(
        db,
        conversation_id=direct_conversation.id,
        sender_id=user_a.id,
        content=msg_content,
        mentioned_user_ids=[user_b.id],
    )

    assert msg_resp.content == msg_content
    assert msg_resp.sender_id == user_a.id

    # Query the junction table directly to verify the mention was recorded
    mentioned_ids = (
        await db.scalars(
            select(message_mentions.c.mentioned_user_id)
            .where(message_mentions.c.message_id == msg_resp.id)
        )
    ).all()
    assert mentioned_ids == [user_b.id]


@pytest.mark.asyncio
async def test_save_message_filters_non_member_mentions(
    db: AsyncSession, user_a: User, user_b: User, user_c: User, direct_conversation
):
    """Ensures users tagged in a message who are NOT members of the chat are safely excluded."""
    msg_resp = await service.save_message(
        db,
        conversation_id=direct_conversation.id,
        sender_id=user_a.id,
        content="Hey @user_c",
        mentioned_user_ids=[user_c.id],  # User C is not in this conversation
    )

    mentioned_ids = (
        await db.scalars(
            select(message_mentions.c.mentioned_user_id)
            .where(message_mentions.c.message_id == msg_resp.id)
        )
    ).all()
    assert mentioned_ids == []


@pytest.mark.asyncio
async def test_save_message_unauthorized_sender(
    db: AsyncSession, user_c: User, direct_conversation
):
    """Ensures an outsider user cannot save messages to a room they don't belong to."""
    with pytest.raises(NotFoundError):
        await service.save_message(
            db,
            conversation_id=direct_conversation.id,
            sender_id=user_c.id,
            content="Unauthorized message",
        )


@pytest.mark.asyncio
async def test_get_conversation_messages_pagination(
    db: AsyncSession, user_a: User, direct_conversation
):
    """Verifies chronological pagination when reading chat logs."""
    # Write 3 sequential messages
    for i in range(3):
        await service.save_message(
            db,
            conversation_id=direct_conversation.id,
            sender_id=user_a.id,
            content=f"Message {i+1}",
        )

    # SQLite's server_default now() is second-granular — force distinct
    # timestamps so ordering is deterministic in this test.
    rows = (
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == direct_conversation.id)
            .order_by(Message.content)
        )
    ).all()
    base = datetime.now(timezone.utc)
    for i, row in enumerate(rows):
        row.created_at = base + timedelta(seconds=i)
    await db.commit()

    messages = await service.get_conversation_messages(
        db, conversation_id=direct_conversation.id, user_id=user_a.id, limit=2, offset=0
    )

    assert len(messages) == 2
    # Verify chronological ordering
    assert messages[0].content == "Message 2"
    assert messages[1].content == "Message 3"


# ── REST API Router Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_create_direct_chat(
    client: AsyncClient, user_a: User, user_b: User
):
    """Tests POST /chats/direct endpoint."""
    response = await client.post(
        "/chats/direct",
        json={"recipient_id": str(user_b.id)},
        headers=auth_headers_for(user_a),
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert len(data["members"]) == 2


@pytest.mark.asyncio
async def test_api_list_conversations(
    client: AsyncClient, user_a: User, direct_conversation
):
    """Tests GET /chats endpoint."""
    response = await client.get("/chats", headers=auth_headers_for(user_a))
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["id"] == str(direct_conversation.id)


@pytest.mark.asyncio
async def test_api_get_chat_history(
    client: AsyncClient, user_a: User, direct_conversation
):
    """Tests GET /chats/{conversation_id}/messages endpoint."""
    response = await client.get(
        f"/chats/{direct_conversation.id}/messages?limit=10&offset=0",
        headers=auth_headers_for(user_a),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ── Manager Unit Tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connection_manager_lifecycle():
    """Tests connect, multi-tab registration, and disconnect logic in ConnectionManager."""
    test_manager = ConnectionManager()
    user_id = uuid.uuid4()

    class MockWebSocket:
        async def accept(self): pass

    ws1 = MockWebSocket()
    ws2 = MockWebSocket()

    # Connect tab 1
    await test_manager.connect(user_id, ws1)
    assert len(test_manager.active_connections[user_id]) == 1

    # Connect tab 2
    await test_manager.connect(user_id, ws2)
    assert len(test_manager.active_connections[user_id]) == 2

    # Disconnect tab 1
    test_manager.disconnect(user_id, ws1)
    assert len(test_manager.active_connections[user_id]) == 1

    # Disconnect tab 2 (User should now be offline)
    test_manager.disconnect(user_id, ws2)
    assert user_id not in test_manager.active_connections