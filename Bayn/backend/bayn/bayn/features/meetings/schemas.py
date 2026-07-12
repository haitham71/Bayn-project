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


class MeetingRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    requester_id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID
    proposed_start_time: datetime
    proposed_end_time: datetime
    message: str | None
    status: MeetingRequestStatus
    expires_at: datetime
    resulting_meeting_id: uuid.UUID | None
    created_at: datetime


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
