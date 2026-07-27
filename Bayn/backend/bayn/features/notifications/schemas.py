"""Pydantic schemas for the Notifications feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from bayn.features.notifications.models import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime

    project_id: uuid.UUID | None = None
    meeting_request_id: uuid.UUID | None = None
    meeting_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    read_at: datetime | None = None


class UnreadCountResponse(BaseModel):
    count: int
    # see common/formatting.format_badge_count
    display: str
