"""Chat business logic — handles database interactions and business logic for conversations and messages."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import func, or_, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from bayn.common.formatting import format_badge_count
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import User
from bayn.features.projects.models import Project, ProjectMembership
from bayn.features.chat.models import Conversation, ConversationMember, Message, message_mentions
from bayn.features.chat.schemas import (
    ChatUserSummary,
    ConversationMemberResponse,
    ConversationResponse,
    MessageResponse,
    UnreadCountResponse,
)
from bayn.integrations.storage.cloudflare import StorageError, r2_client


def _get_avatar_url_safely(avatar_key: str | None) -> str | None:
    """Helper to safely fetch avatar URL from R2 without breaking the response."""
    if not avatar_key:
        return None
    try:
        return r2_client.get_avatar_url(avatar_key)
    except StorageError:
        return None


def _build_user_summary(user: User) -> ChatUserSummary:
    """Helper to convert a User model into a lightweight ChatUserSummary."""
    return ChatUserSummary(
        id=user.id,
        first_name_ar=user.first_name_ar,
        last_name_ar=user.last_name_ar,
        first_name_en=user.first_name_en,
        last_name_en=user.last_name_en,
        username=user.username,
        avatar_url=_get_avatar_url_safely(user.avatar_key),
    )


# ── Conversation Core Queries ──────────────────────────────────────────────────

async def get_conversation_member_ids(db: AsyncSession, conversation_id: uuid.UUID) -> list[uuid.UUID]:
    """Retrieves all participant user IDs in a conversation for routing broadcasts."""
    result = await db.execute(
        select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id)
    )
    return list(result.scalars().all())


async def get_or_create_direct_conversation(
    db: AsyncSession, user_a_id: uuid.UUID, user_b_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> ConversationResponse:
    """
    Finds an existing 1-on-1 conversation room between two users.
    If none exists, initializes and saves a new one.
    """
    if user_a_id == user_b_id:
        raise ValidationError(t("chat", "error.cannot_chat_self", locale))

    # Verify recipient exists first
    recipient = await db.scalar(select(User).where(User.id == user_b_id, User.deleted_at.is_(None)))
    if not recipient:
        raise NotFoundError(t("identity", "auth.user_not_found", locale))

    # 1. Query to find if a 1-on-1 conversation between A and B already exists
    # Find all conversation IDs where user_a is a member
    query_a = select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_a_id)
    # Find all conversation IDs where user_b is a member
    query_b = select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_b_id)
    
    # Intersect them to find conversations they both share
    shared_convs = select(ConversationMember.conversation_id).where(
        ConversationMember.conversation_id.in_(query_a),
        ConversationMember.conversation_id.in_(query_b)
    )

    # Filter shared conversations to find a real 1-on-1: exactly 2 members AND
    # not a project group room (project_id is null), so a 2-person project chat
    # is never mistaken for a direct message.
    matching_conv_query = (
        select(ConversationMember.conversation_id)
        .join(Conversation, Conversation.id == ConversationMember.conversation_id)
        .where(
            ConversationMember.conversation_id.in_(shared_convs),
            Conversation.project_id.is_(None),
        )
        .group_by(ConversationMember.conversation_id)
        .having(func.count(ConversationMember.user_id) == 2)
    )
    
    matching_conv_id = await db.scalar(matching_conv_query)

    if matching_conv_id:
        # Load and return the existing conversation
        return await get_conversation_by_id(db, matching_conv_id, user_a_id, locale)

    # 2. If no matching conversation exists, create a new one
    new_conv = Conversation()
    db.add(new_conv)
    await db.flush()  # Generates the conversation ID so we can bind memberships

    # Add both users as members
    member_a = ConversationMember(conversation_id=new_conv.id, user_id=user_a_id)
    member_b = ConversationMember(conversation_id=new_conv.id, user_id=user_b_id)
    db.add_all([member_a, member_b]) # maximum members of a chat???

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise ConflictError(t("chat", "error.failed_to_create_chat", locale))

    return await get_conversation_by_id(db, new_conv.id, user_a_id, locale)


async def get_or_create_project_conversation(
    db: AsyncSession, project_id: uuid.UUID, current_user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> ConversationResponse:
    """The single team group chat for a project. The caller must be a project
    member; any members missing from the room are added so it always mirrors the
    current team."""
    # 1. The caller must belong to the project.
    caller = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == current_user_id,
        )
    )
    if not caller:
        raise ForbiddenError(t("chat", "error.not_project_member", locale))

    # 2. All current project member ids.
    member_ids = list(
        (
            await db.execute(
                select(ProjectMembership.user_id).where(ProjectMembership.project_id == project_id)
            )
        ).scalars().all()
    )

    # 3. Find the project's room, or create it with the whole team.
    conv = await db.scalar(select(Conversation).where(Conversation.project_id == project_id))
    if conv is None:
        project = await db.get(Project, project_id)
        conv = Conversation(project_id=project_id, title=project.title if project else None)
        db.add(conv)
        await db.flush()  # assigns conv.id
        for uid in member_ids:
            db.add(ConversationMember(conversation_id=conv.id, user_id=uid))
        await db.commit()
    else:
        # Keep the room in sync with the team (add newly-joined members).
        existing = set(
            (
                await db.execute(
                    select(ConversationMember.user_id).where(
                        ConversationMember.conversation_id == conv.id
                    )
                )
            ).scalars().all()
        )
        missing = [uid for uid in member_ids if uid not in existing]
        if missing:
            for uid in missing:
                db.add(ConversationMember(conversation_id=conv.id, user_id=uid))
            await db.commit()

    return await get_conversation_by_id(db, conv.id, current_user_id, locale)


async def get_conversation_by_id(
    db: AsyncSession, conversation_id: uuid.UUID, current_user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> ConversationResponse:
    """Fetches full details of a specific conversation including its members and latest message."""
    # Ensure the current user is actually a member of this conversation (Access Control!)
    is_member = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user_id,
        )
    )
    if not is_member:
        raise NotFoundError(t("chat", "error.conversation_not_found", locale))

    # Fetch conversation with its member mappings and nested user objects preloaded
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise NotFoundError(t("chat", "error.conversation_not_found", locale))

    # Fetch the last message written in this room
    last_msg = await db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
        .limit(1)
        .options(selectinload(Message.sender)) # how would that show? like in an email?
    )

    last_msg_response = None
    if last_msg:
        last_msg_response = MessageResponse(
            id=last_msg.id,
            conversation_id=last_msg.conversation_id,
            sender_id=last_msg.sender_id,
            content=last_msg.content,
            created_at=last_msg.created_at,
            sender=_build_user_summary(last_msg.sender),
        )

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        members=[
            ConversationMemberResponse(
                user_id=m.user_id,
                joined_at=m.joined_at,
                user=_build_user_summary(m.user),
            )
            for m in conv.members
        ],
        last_message=last_msg_response,
    )


async def get_user_conversations(db: AsyncSession, user_id: uuid.UUID) -> list[ConversationResponse]:
    """Retrieves all conversations the user is currently participating in, sorted by latest message activity."""
    # Find all conversation IDs the user belongs to
    member_conv_ids_query = select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
    member_conv_ids = (await db.execute(member_conv_ids_query)).scalars().all()

    if not member_conv_ids:
        return []

    # Fetch those conversations pre-loading members and underlying users
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id.in_(member_conv_ids))
        .options(selectinload(Conversation.members).selectinload(ConversationMember.user))
        .order_by(desc(Conversation.updated_at))
    )
    conversations = result.scalars().all()

    response_list = []
    for conv in conversations:
        # Fetch last message details
        last_msg = await db.scalar(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
            .options(selectinload(Message.sender))
        )

        last_msg_response = None
        if last_msg:
            last_msg_response = MessageResponse(
                id=last_msg.id,
                conversation_id=last_msg.conversation_id,
                sender_id=last_msg.sender_id,
                content=last_msg.content,
                created_at=last_msg.created_at,
                sender=_build_user_summary(last_msg.sender),
            )

        # Unread for this user: messages newer than their last_read_at, not their own.
        my_member = next((m for m in conv.members if m.user_id == user_id), None)
        my_last_read = my_member.last_read_at if my_member else None
        unread_conds = [Message.conversation_id == conv.id, Message.sender_id != user_id]
        if my_last_read is not None:
            unread_conds.append(Message.created_at > my_last_read)
        unread_count = await db.scalar(
            select(func.count()).select_from(Message).where(*unread_conds)
        )

        response_list.append(
            ConversationResponse(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                members=[
                    ConversationMemberResponse(
                        user_id=m.user_id,
                        joined_at=m.joined_at,
                        user=_build_user_summary(m.user),
                    )
                    for m in conv.members
                ],
                last_message=last_msg_response,
                unread_count=unread_count or 0,
            )
        )

    # Sort conversations with recent message activity to the top
    response_list.sort(
        key=lambda x: x.last_message.created_at if x.last_message else x.updated_at,
        reverse=True,
    )
    return response_list


# ── Message Core Operations ───────────────────────────────────────────────────

async def save_message(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    content: str,
    mentioned_user_ids: list[uuid.UUID] | None = None,
    locale: str = DEFAULT_LOCALE,
) -> MessageResponse:
    """Saves a new chat message to PostgreSQL and bumps the parent conversation's updated_at timestamp."""
    # 1. Verify user membership in conversation before writing message (Security)
    is_member = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == sender_id,
        )
    )
    if not is_member:
        raise NotFoundError(t("chat", "error.conversation_not_found", locale))

    # 2. Write the Message record
    new_message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
    )
    db.add(new_message)
    await db.flush()  # assigns new_message.id so mentions can reference it

    # 2b. Record @mentions — only for real members of this conversation (and not
    # the sender themselves), so a bad id can't break the write.
    if mentioned_user_ids:
        member_ids = set(
            (
                await db.execute(
                    select(ConversationMember.user_id).where(
                        ConversationMember.conversation_id == conversation_id
                    )
                )
            ).scalars().all()
        )
        valid = [uid for uid in set(mentioned_user_ids) if uid in member_ids and uid != sender_id]
        if valid:
            await db.execute(
                message_mentions.insert(),
                [{"message_id": new_message.id, "mentioned_user_id": uid} for uid in valid],
            )

    # 3. Bump the updated_at timestamp on parent conversation to buble it up in inboxes
    conversation = await db.get(Conversation, conversation_id)
    if conversation:
        conversation.updated_at = datetime.now(timezone.utc)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise ValidationError(t("chat", "error.message_send_failed", locale))

    # Re-fetch message with its sender object preloaded for delivery
    message_with_sender = await db.scalar(
        select(Message)
        .where(Message.id == new_message.id)
        .options(selectinload(Message.sender))
    )

    return MessageResponse(
        id=message_with_sender.id,
        conversation_id=message_with_sender.conversation_id,
        sender_id=message_with_sender.sender_id,
        content=message_with_sender.content,
        created_at=message_with_sender.created_at,
        sender=_build_user_summary(message_with_sender.sender),
    )


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    locale: str = DEFAULT_LOCALE,
) -> list[MessageResponse]:
    """Retrieves standard historical messages inside a room, ordered chronologically (oldest to newest)."""
    # Verify access
    is_member = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if not is_member:
        raise NotFoundError(t("chat", "error.conversation_not_found", locale))

    # Fetch messages in reverse-chronological order to apply limit/offset pagination correctly,
    # then we reverse them in Python to deliver standard chronological reading order.
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
        .limit(limit)
        .offset(offset)
        .options(selectinload(Message.sender))
    )
    messages = result.scalars().all()

    response_messages = [
        MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            content=msg.content,
            created_at=msg.created_at,
            sender=_build_user_summary(msg.sender),
        )
        for msg in messages
    ]

    # Reverse list to make sure oldest message is first in the chronological chat log stream
    response_messages.reverse()
    return response_messages

# NOTE: an earlier draft `send_message` (channel_id / encrypted_content /
# ChatMessage / notify_user_of_mention) was broken and unused — @mention handling
# now lives in save_message above, which the WebSocket endpoint calls.

# ── Unread tracking ────────────────────────────────────────────────────────────

async def get_unread_message_count(
    db: AsyncSession, user_id: uuid.UUID, direct_only: bool = False
) -> UnreadCountResponse:
    # a message counts as unread if it postdates the member's last_read_at for
    # that conversation (or the member never read it at all) and isn't their own
    query = (
        select(func.count())
        .select_from(Message)
        .join(ConversationMember, ConversationMember.conversation_id == Message.conversation_id)
        .where(
            ConversationMember.user_id == user_id,
            Message.sender_id != user_id,
            or_(
                ConversationMember.last_read_at.is_(None),
                Message.created_at > ConversationMember.last_read_at,
            ),
        )
    )
    if direct_only:
        # Only 1-on-1 rooms — project team chats have their own notification.
        query = query.join(Conversation, Conversation.id == Message.conversation_id).where(
            Conversation.project_id.is_(None)
        )
    count = await db.scalar(query)
    return UnreadCountResponse(count=count, display=format_badge_count(count))


async def mark_conversation_read(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    member = await db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )
    if not member:
        raise NotFoundError(t("chat", "error.conversation_not_found", locale))

    member.last_read_at = datetime.now(timezone.utc)
    await db.commit()
