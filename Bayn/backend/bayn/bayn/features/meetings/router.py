"""Meetings router: propose/accept/reject/cancel meeting requests, list
confirmed meetings, and record attendance."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.meetings import service
from bayn.features.meetings.schemas import (
    MeetingAttendanceResponse,
    MeetingAttendanceUpdate,
    MeetingRequestCreate,
    MeetingRequestResponse,
    MeetingResponse,
)

router = APIRouter(prefix="/meetings", tags=["Meetings"])


# ── Meeting requests ─────────────────────────────────────────────────────────

@router.post(
    "/requests", response_model=MeetingRequestResponse, status_code=201, summary="Propose a meeting time"
)
async def create_meeting_request(
    payload: MeetingRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    return await service.create_meeting_request(db, current_user.id, payload, locale)


@router.get("/requests", response_model=list[MeetingRequestResponse], summary="List meeting requests")
async def list_meeting_requests(
    role: Literal["incoming", "outgoing"] = Query(..., description="incoming = as owner, outgoing = as requester"),
    project_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[MeetingRequestResponse]:
    return await service.list_meeting_requests(db, current_user.id, role, project_id)


@router.post(
    "/requests/{request_id}/accept",
    response_model=MeetingResponse,
    status_code=201,
    summary="Accept a meeting request (owner only)",
)
async def accept_meeting_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingResponse:
    return await service.accept_meeting_request(db, request_id, current_user.id, locale)


@router.post(
    "/requests/{request_id}/reject",
    response_model=MeetingRequestResponse,
    summary="Reject a meeting request (owner only)",
)
async def reject_meeting_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    return await service.reject_meeting_request(db, request_id, current_user.id, locale)


@router.post(
    "/requests/{request_id}/cancel",
    response_model=MeetingRequestResponse,
    summary="Cancel a meeting request (requester only)",
)
async def cancel_meeting_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    return await service.cancel_meeting_request(db, request_id, current_user.id, locale)


# ── Meetings ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MeetingResponse], summary="List my confirmed meetings")
async def list_meetings(
    project_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[MeetingResponse]:
    return await service.list_meetings(db, current_user.id, project_id)


@router.get("/{meeting_id}", response_model=MeetingResponse, summary="Get a meeting")
async def get_meeting(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingResponse:
    return await service.get_meeting(db, meeting_id, current_user.id, locale)


@router.patch(
    "/{meeting_id}/attendance", response_model=MeetingAttendanceResponse, summary="Record my own attendance"
)
async def update_attendance(
    meeting_id: uuid.UUID,
    payload: MeetingAttendanceUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingAttendanceResponse:
    return await service.update_attendance(db, meeting_id, current_user.id, payload, locale)
