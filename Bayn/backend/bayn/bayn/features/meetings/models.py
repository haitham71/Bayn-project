"""Meetings models: meeting requests, confirmed meetings, and attendance."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


class MeetingRequestStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    cancelled = "cancelled"
    expired = "expired"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"


class MeetingRequest(Base):
    """A member's proposal to meet the project owner at a specific time.
    Owner accepts (-> creates a Meeting) or rejects; the requester can
    cancel while it's still pending; unaddressed requests simply expire."""
    __tablename__ = "meeting_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    proposed_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    proposed_end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Set when this request comes from a joiner picking a published slot. Its
    # presence marks the request as a "join request": accepting it also adds the
    # requester to the project and marks the slot taken.
    slot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_meeting_slots.id"), nullable=True
    )

    status: Mapped[MeetingRequestStatus] = mapped_column(
        Enum(MeetingRequestStatus, values_callable=lambda x: [e.value for e in x]),
        default=MeetingRequestStatus.pending,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # set once the owner accepts and a Meeting is created from this request
    resulting_meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<MeetingRequest {self.requester_id} -> {self.owner_id} ({self.status})>"


class Meeting(Base):
    """A confirmed meeting between two users about a project."""
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # the requester who scheduled the meeting
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # the project owner they're meeting with
    counterpart_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # first meeting ever held between this pair of users for this project
    # (e.g. gates when an NDA needs to be signed)
    is_initial_meeting: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # best-effort — Cal.com is not the source of truth for scheduling here,
    # so a failed/skipped booking still leaves this null rather than blocking
    calcom_booking_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    attendances: Mapped[list["MeetingAttendance"]] = relationship(
        "MeetingAttendance", back_populates="meeting", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Meeting {self.user_id} <-> {self.counterpart_id} @ {self.start_time}>"


class MeetingAttendance(Base):
    """Per-participant attendance record for a confirmed meeting."""
    __tablename__ = "meeting_attendances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_memberships.id"), nullable=False
    )
    # null until someone records it (self-reported or set from a future Daily.co webhook)
    status: Mapped[AttendanceStatus | None] = mapped_column(
        Enum(AttendanceStatus, values_callable=lambda x: [e.value for e in x]), nullable=True
    )
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="attendances")

    def __repr__(self) -> str:
        return f"<MeetingAttendance meeting={self.meeting_id} membership={self.membership_id} status={self.status}>"
