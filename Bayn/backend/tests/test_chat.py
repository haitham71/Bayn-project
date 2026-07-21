"""Comprehensive async test suite for the Bayn Chat module."""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from bayn.common.exceptions import NotFoundError, ValidationError
from bayn.features.identity.models import User
from bayn.features.chat.models import Conversation, ConversationMember, Message
from bayn.features.chat.schemas import WSIncomingMessage, WSOutgoingMessage
from bayn.features.chat import service
from bayn.features.chat.manager import ConnectionManager


# ── Fixtures & Setup ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user_a(db_session: AsyncSession) -> User:
    """Creates primary test user A."""
    user = User(
        id=uuid.uuid4(),
        username="user_a",
        first_name_ar="علي",
        last_name_ar="أحمد",
        first_name_en="Ali",
        last_name_en="Ahmed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_b(db_session: AsyncSession) -> User:
    """Creates secondary test user B."""
    user = User(
        id=uuid.uuid4(),
        username="user_b",
        first_name_ar="سارة",
        last_name_ar="محمد",
        first_name_en="Sara",
        last_name_en="Mohammed",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_c(db_session: AsyncSession) -> User:
    """Creates tertiary test user C (outsider user)."""
    user = User(
        id=uuid.uuid4(),
        username="user_c",
        first_name_ar="خالد",
        last_name_ar="العتيبي",
        first_name_en="Khaled",
        last_name_en="Al-Otaibi",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def direct_conversation(
    db_session: AsyncSession, user_a: User, user_b: User
):
    """Initializes a direct 1-on-1 conversation between User A and User B."""
    return await service.get_or_create_direct_conversation(
        db_session, user_a_id=user_a.id, user_b_id=user_b.id
    )


# ── Service Layer Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_or_create_direct_conversation_new(
    db_session: AsyncSession, user_a: User, user_b: User
):
    """Tests creating a brand-new direct chat between two users."""
    conv_resp = await service.get_or_create_direct_conversation(
        db_session, user_a_id=user_a.id, user_b_id=user_b.id
    )
    assert conv_resp.id is not None
    assert len(conv_resp.members) == 2
    
    member_ids = {m.user_id for m in conv_resp.members}
    assert member_ids == {user_a.id, user_b.id}


@pytest.mark.asyncio
async def test_get_or_create_direct_conversation_idempotent(
    db_session: AsyncSession, user_a: User, user_b: User
):
    """Ensures repeated calls return the same existing conversation ID instead of creating duplicates."""
    conv_1 = await service.get_or_create_direct_conversation(
        db_session, user_a_id=user_a.id, user_b_id=user_b.id
    )
    conv_2 = await service.get_or_create_direct_conversation(
        db_session, user_a_id=user_b.id, user_b_id=user_a.id
    )
    assert conv_1.id == conv_2.id


@pytest.mark.asyncio
async def test_cannot_chat_with_self(db_session: AsyncSession, user_a: User):
    """Verifies that starting a chat with oneself throws a ValidationError."""
    with pytest.raises(ValidationError):
        await service.get_or_create_direct_conversation(
            db_session, user_a_id=user_a.id, user_b_id=user_a.id
        )


@pytest.mark.asyncio
async def test_save_message_with_mentions(
    db_session: AsyncSession, user_a: User, user_b: User, direct_conversation
):
    """Verifies saving a message with @mentions and checking database state."""
    msg_content = "Hey @user_b check this architecture!"
    
    msg_resp = await service.save_message(
        db_session,
        conversation_id=direct_conversation.id,
        sender_id=user_a.id,
        content=msg_content,
        mentioned_user_ids=[user_b.id],
    )

    assert msg_resp.content == msg_content
    assert msg_resp.sender_id == user_a.id

    # Query DB directly to verify the junction table entry
    db_msg = await db_session.scalar(
        select(Message)
        .where(Message.id == msg_resp.id)
    )
    await db_session.refresh(db_msg, ["mentions"])
    assert len(db_msg.mentions) == 1
    assert db_msg.mentions[0].id == user_b.id


@pytest.mark.asyncio
async def test_save_message_filters_non_member_mentions(
    db_session: AsyncSession, user_a: User, user_b: User, user_c: User, direct_conversation
):
    """Ensures users tagged in a message who are NOT members of the chat are safely excluded."""
    msg_resp = await service.save_message(
        db_session,
        conversation_id=direct_conversation.id,
        sender_id=user_a.id,
        content="Hey @user_c",
        mentioned_user_ids=[user_c.id],  # User C is not in this conversation
    )

    db_msg = await db_session.scalar(select(Message).where(Message.id == msg_resp.id))
    await db_session.refresh(db_msg, ["mentions"])
    assert len(db_msg.mentions) == 0


@pytest.mark.asyncio
async def test_save_message_unauthorized_sender(
    db_session: AsyncSession, user_c: User, direct_conversation
):
    """Ensures an outsider user cannot save messages to a room they don't belong to."""
    with pytest.raises(NotFoundError):
        await service.save_message(
            db_session,
            conversation_id=direct_conversation.id,
            sender_id=user_c.id,
            content="Unauthorized message",
        )


@pytest.mark.asyncio
async def test_get_conversation_messages_pagination(
    db_session: AsyncSession, user_a: User, direct_conversation
):
    """Verifies chronological pagination when reading chat logs."""
    # Write 3 sequential messages
    for i in range(3):
        await service.save_message(
            db_session,
            conversation_id=direct_conversation.id,
            sender_id=user_a.id,
            content=f"Message {i+1}",
        )

    messages = await service.get_conversation_messages(
        db_session, conversation_id=direct_conversation.id, user_id=user_a.id, limit=2, offset=0
    )

    assert len(messages) == 2
    # Verify chronological ordering
    assert messages[0].content == "Message 2"
    assert messages[1].content == "Message 3"


# ── REST API Router Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_create_direct_chat(
    async_client: AsyncClient, user_a: User, user_b: User, auth_headers_a: dict
):
    """Tests POST /chats/direct endpoint."""
    response = await async_client.post(
        "/chats/direct",
        json={"recipient_id": str(user_b.id)},
        headers=auth_headers_a,
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert len(data["members"]) == 2


@pytest.mark.asyncio
async def test_api_list_conversations(
    async_client: AsyncClient, user_a: User, direct_conversation, auth_headers_a: dict
):
    """Tests GET /chats endpoint."""
    response = await async_client.get("/chats", headers=auth_headers_a)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["id"] == str(direct_conversation.id)


@pytest.mark.asyncio
async def test_api_get_chat_history(
    async_client: AsyncClient, user_a: User, direct_conversation, auth_headers_a: dict
):
    """Tests GET /chats/{conversation_id}/messages endpoint."""
    response = await async_client.get(
        f"/chats/{direct_conversation.id}/messages?limit=10&offset=0",
        headers=auth_headers_a,
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