"""Pydantic schemas for the Chat feature."""

import uuid
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ChatUserSummary(BaseModel): #should be username + avatar then firstname + lastname should be optional (or username is optional)
    """Minimal user summary to embed in conversation lists and message details.""" # one of the languages, not both. depending on the the user
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name_ar: str
    last_name_ar: str
    first_name_en: str
    last_name_en: str
    username: str
    avatar_url: str | None = None # none?? + why does the avatar uses a url?


class MessageResponse(BaseModel):
    """Schema representing an individual message delivered to clients."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime
    sender: ChatUserSummary

class MessageMentionRequest(BaseModel):
    """Payload schema purely for routing @mention notification events."""
    conversation_id: uuid.UUID
    mentioned_user_ids: list[uuid.UUID] = Field(
        default_factory=list, 
        description="List of User UUIDs explicitly @mentioned"
    )

class SendMessageRequest(BaseModel):
    """Payload schema for sending a message via HTTP REST endpoint (if applicable)."""
    conversation_id: uuid.UUID
    content: str = Field(..., min_length=1, max_length=4000)
    mentioned_user_ids: list[uuid.UUID] = Field(default_factory=list)

class ConversationMemberResponse(BaseModel):
    """Schema representing a member inside a specific conversation."""
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    joined_at: datetime # Q: every time the user joins a chat, does everyone else gets notified that that user has joind, or just the first time?
    user: ChatUserSummary # A: just the first time, like a WhatApp chat.


class ConversationResponse(BaseModel):
    """Schema representing a full conversation room details with its members."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    members: list[ConversationMemberResponse]
    last_message: MessageResponse | None = None


class DirectChatCreateRequest(BaseModel):
    """Payload validation for starting a new direct chat with a peer user."""
    recipient_id: uuid.UUID


class UnreadCountResponse(BaseModel):
    count: int
    # see common.formatting.format_badge_count
    display: str


# ── Real-time WebSocket Protocol Schemas ──────────────────────────────────────

class WSIncomingMessage(BaseModel):
    """Validates messages sent by clients over active WebSocket connections."""
    conversation_id: uuid.UUID
    content: str = Field(..., min_length=1, max_length=2000) # i think i got it but needs a little more clarity


class WSOutgoingMessage(BaseModel):
    """Standardized wrapping structure for data pushed out to WebSocket clients."""
    event: str  # e.g., "new_message", "user_typing", "error"
    data: dict  # Dynamic payload matching schemas above or custom metadata