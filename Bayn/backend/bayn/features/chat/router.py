"""Chat Router — Exposes HTTP endpoints for chat management and the real-time WebSocket connection."""

import uuid
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.security import decode_token
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.chat.manager import manager
from bayn.features.chat.schemas import (
    ConversationResponse,
    DirectChatCreateRequest,
    MessageResponse,
    WSIncomingMessage,
    WSOutgoingMessage,
)
from bayn.features.chat import service

router = APIRouter(prefix="/chats", tags=["Chat"])


async def _user_from_token(token: str, db: AsyncSession) -> User:
    """Resolve a User from a raw JWT access token — used by the WebSocket
    handshake, which can't go through the HTTP auth dependency."""
    user_id = decode_token(token, "access")
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise ValueError("invalid token")
    return user


# ── HTTP REST Endpoints ───────────────────────────────────────────────────────

@router.post("/direct", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_or_get_direct_chat(
    payload: DirectChatCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Initializes or retrieves an existing 1-on-1 conversation room."""
    return await service.get_or_create_direct_conversation(
        db, user_a_id=current_user.id, user_b_id=payload.recipient_id
    )


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all conversations the authenticated user is currently in, sorted by activity."""
    return await service.get_user_conversations(db, user_id=current_user.id)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_chat_history(
    conversation_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves standard paginated message history logs for a specific conversation."""
    return await service.get_conversation_messages(
        db, conversation_id=conversation_id, user_id=current_user.id, limit=limit, offset=offset
    )


# ── Live WebSocket Protocol ───────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),  # Clients pass their JWT token in the query string: ws://.../ws?token=JWT
    db: AsyncSession = Depends(get_db),
):
    """Dedicated bi-directional socket pipeline for real-time messaging."""
    # 1. Authenticate the WebSocket connection up front
    try:
        user = await _user_from_token(token, db)
    except Exception:
        # Close connection immediately if the token is invalid or expired
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Register the online user into the memory state of our Connection Manager
    await manager.connect(user_id=user.id, websocket=websocket)

    try:
        # Keep the socket open and listen continuously for incoming message frames
        while True:
            # Wait for the client to send a JSON payload
            data = await websocket.receive_json()
            
            # Validate payload using Pydantic
            try:
                incoming_msg = WSIncomingMessage(**data)
            except Exception:
                # If the payload is malformed, send a private error frame back over the socket
                error_payload = WSOutgoingMessage(
                    event="error", 
                    data={"detail": "Invalid message structure or constraints violated."}
                )
                await manager.send_personal_message(error_payload.model_dump(), user.id)
                continue

            # Save the valid message securely to PostgreSQL
            try:
                saved_msg_resp = await service.save_message(
                    db,
                    conversation_id=incoming_msg.conversation_id,
                    sender_id=user.id,
                    content=incoming_msg.content,
                    mentioned_user_ids=incoming_msg.mentioned_user_ids,
                )
            except Exception as e:
                # Catch database validation errors (e.g. user is no longer in this chat)
                error_payload = WSOutgoingMessage(event="error", data={"detail": str(e)})
                await manager.send_personal_message(error_payload.model_dump(), user.id)
                continue

            # Fetch all recipients (members) of this conversation room
            member_ids = await service.get_conversation_member_ids(db, incoming_msg.conversation_id)

            # Build standard outward payload
            broadcast_payload = WSOutgoingMessage(
                event="new_message",
                data=saved_msg_resp.model_dump(mode="json")
            )

            # Broadcast the new message in real-time to everyone currently online in the room!
            await manager.broadcast_to_conversation(broadcast_payload.model_dump(), member_ids)

    except WebSocketDisconnect:
        # Gracefully handle normal disconnects (closed browser, tab, or lost signal)
        manager.disconnect(user_id=user.id, websocket=websocket)
    except Exception:
        # Handle unexpected socket errors
        manager.disconnect(user_id=user.id, websocket=websocket)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)