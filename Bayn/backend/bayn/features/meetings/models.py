"""Meetings models: meeting requests, confirmed meetings, and attendance."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


class MeetingRequestStatus(str, enum.Enum):
    """Lifecycle of a request, from submitted to a final membership decision.

    The happy path is pending -> awaiting_signatures -> scheduled -> approved.
    A request only reaches `scheduled` once every party has signed the NDA, so
    a meeting never exists with an unsigned party in it.
    """
    pending = "pending"
    # owner took the slot; NDA created and both parties emailed a signing link
    awaiting_signatures = "awaiting_signatures"
    # everyone signed — the meeting exists and is joinable
    scheduled = "scheduled"
    # the owner's call after the meeting: approved grants membership, declined doesn't
    approved = "approved"
    declined = "declined"

    # kept for rows written before the NDA gate existed, where accepting created
    # the meeting outright. Treated as `scheduled` when read.
    accepted = "accepted"

    rejected = "rejected"
    cancelled = "cancelled"
    expired = "expired"


# Statuses where a meeting exists and the post-meeting decision is still open.
SCHEDULED_STATUSES = (MeetingRequestStatus.scheduled, MeetingRequestStatus.accepted)

# A request that is still going somewhere. Membership is only granted at the very
# end of the flow, so "are they already a member" no longer answers "do they
# already have a request in flight" — this does.
ACTIVE_REQUEST_STATUSES = (
    MeetingRequestStatus.pending,
    MeetingRequestStatus.awaiting_signatures,
    *SCHEDULED_STATUSES,
)


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"


class MeetingRequest(Base):
    """A member's proposal to meet the project owner at a specific time.

    Accepting no longer creates the meeting: it creates an NDA both parties
    must sign, and only a fully signed NDA promotes the request to `scheduled`
    and builds the Meeting. The requester can cancel while it's still pending;
    unaddressed requests simply expire."""
    __tablename__ = "meeting_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    proposed_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    proposed_end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Optional title the owner sets when accepting; used as the meeting's title
    # (falls back to the project title when left blank).
    meeting_title: Mapped[str | None] = mapped_column(String(200), nullable=True)

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

    # set once every party has signed and a Meeting is created from this request
    resulting_meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("meetings.id"), nullable=True
    )

    # when the owner made the post-meeting call (approved / declined)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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

    # Long enough for a composed "<owner title> - <project title>" (each up to 200).
    title: Mapped[str | None] = mapped_column(String(420), nullable=True)
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
