"""Pydantic schemas for the Meetings feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bayn.features.meetings.models import AttendanceStatus, MeetingRequestStatus


class MeetingRequestCreate(BaseModel):
    project_id: uuid.UUID
    proposed_start_time: datetime
    proposed_end_time: datetime
    message: str | None = Field(default=None, max_length=500)


class JoinRequestCreate(BaseModel):
    """A joiner asking to join a project by picking one of its published slots."""
    project_id: uuid.UUID
    slot_id: uuid.UUID
    message: str | None = Field(default=None, max_length=500)


class RequesterInfo(BaseModel):
    """Public info about the person who sent a request."""
    id: uuid.UUID
    name_en: str
    name_ar: str
    job_title: str | None = None
    # "Riyadh, Saudi Arabia" — None when the user set neither city nor country.
    location_en: str | None = None
    location_ar: str | None = None
    # the requester's skills (names), so the owner can judge the fit at a glance
    skills: list[str] = Field(default_factory=list)


class SignatureState(BaseModel):
    """Who still has to sign the NDA before the meeting can be scheduled.

    Deliberately narrow: the UI needs to say "waiting on them" vs "waiting on
    you" and nothing more. Signing links, PDFs and signature images stay in
    Signature-System.
    """
    requester_signed: bool
    owner_signed: bool


class MeetingRequestAccept(BaseModel):
    """Optional title the owner gives the meeting when accepting; blank falls
    back to the project title."""
    title: str | None = Field(default=None, max_length=200)


class MeetingRequestFinalize(BaseModel):
    """The owner's post-meeting call — approve registers the requester as a
    project member, decline leaves them out."""
    approve: bool


class MeetingRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    requester_id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    proposed_start_time: datetime
    proposed_end_time: datetime
    message: str | None
    slot_id: uuid.UUID | None
    status: MeetingRequestStatus
    expires_at: datetime
    resulting_meeting_id: uuid.UUID | None
    decided_at: datetime | None = None
    created_at: datetime
    requester: RequesterInfo | None = None
    # only set while the request is awaiting signatures
    signatures: SignatureState | None = None


class ParticipantInfo(BaseModel):
    """A meeting participant, for showing attendee avatars."""
    id: uuid.UUID
    name_en: str
    name_ar: str
    avatar_url: str | None = None


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    counterpart_id: uuid.UUID
    project_id: uuid.UUID
    title: str | None
    start_time: datetime
    end_time: datetime
    is_initial_meeting: bool
    calcom_booking_id: str | None
    video_link: str | None
    created_at: datetime
    participants: list[ParticipantInfo] = []


class MeetingJoinResponse(BaseModel):
    """A ready-to-open join URL with the caller's Daily token appended."""
    url: str
    # when the meeting is scheduled to end, so the client can leave gracefully
    ends_at: datetime


class MeetingAttendanceUpdate(BaseModel):
    status: AttendanceStatus


class MeetingAttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    meeting_id: uuid.UUID
    membership_id: uuid.UUID
    status: AttendanceStatus | None
    joined_at: datetime | None
    left_at: datetime | None
