"""Notifications models: in-app notifications for meeting and task events.

Content isn't stored pre-rendered in Arabic/English — `data` holds the
structured params (actor names in both languages, project title, related
ids...), the same way every
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from bayn.core.database import Base


class NotificationType(str, enum.Enum):
    meeting_request_received = "meeting_request_received"
    meeting_request_accepted = "meeting_request_accepted"
    meeting_request_rejected = "meeting_request_rejected"
    meeting_scheduled = "meeting_scheduled"
    meeting_cancelled = "meeting_cancelled"
    task_assigned = "task_assigned"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Notification user={self.user_id} type={self.type}>"
