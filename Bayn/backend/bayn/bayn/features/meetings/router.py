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
    JoinRequestCreate,
    MeetingAttendanceResponse,
    MeetingAttendanceUpdate,
    MeetingJoinResponse,
    MeetingRequestCreate,
    MeetingRequestAccept,
    MeetingRequestFinalize,
    MeetingRequestResponse,
    MeetingResponse,
    TeamMeetingCreate,
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


@router.post(
    "/join-requests", response_model=MeetingRequestResponse, status_code=201,
    summary="Request to join a project by picking one of its meeting slots",
)
async def create_join_request(
    payload: JoinRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    return await service.create_join_request(db, current_user.id, payload, locale)


@router.get("/requests", response_model=list[MeetingRequestResponse], summary="List meeting requests")
async def list_meeting_requests(
    role: Literal["incoming", "outgoing"] = Query(..., description="incoming = as owner, outgoing = as requester"),
    project_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[MeetingRequestResponse]:
    requests = await service.list_meeting_requests(db, current_user.id, role, project_id)
    # Signing happens in Signature-System, which can't reach us unless the
    # webhook is wired, so reading a request is also when we notice it went
    # through. Only touches rows awaiting signature.
    for r in requests:
        await service.refresh_request_state(db, r, locale)

    requesters = await service.requesters_map(db, [r.requester_id for r in requests])
    signatures = await service.signature_map(db, requests)
    result = []
    for r in requests:
        resp = MeetingRequestResponse.model_validate(r)
        resp.requester = requesters.get(r.requester_id)
        resp.signatures = signatures.get(r.id)
        result.append(resp)
    return result


@router.post(
    "/requests/{request_id}/accept",
    response_model=MeetingRequestResponse,
    status_code=201,
    summary="Accept the proposed slot and send both parties the NDA (owner only)",
)
async def accept_meeting_request(
    request_id: uuid.UUID,
    payload: MeetingRequestAccept | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    """Does not schedule the meeting — that happens once both parties sign."""
    return await service.accept_meeting_request(
        db, request_id, current_user.id, locale, meeting_title=payload.title if payload else None
    )


@router.post(
    "/requests/{request_id}/finalize",
    response_model=MeetingRequestResponse,
    summary="Approve or decline the requester after the meeting (owner only)",
)
async def finalize_meeting_request(
    request_id: uuid.UUID,
    payload: MeetingRequestFinalize,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingRequestResponse:
    return await service.finalize_meeting_request(
        db, request_id, current_user.id, payload.approve, locale
    )


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

@router.post(
    "/team",
    response_model=MeetingResponse,
    status_code=201,
    summary="Owner schedules a project meeting with selected members",
)
async def create_team_meeting(
    payload: TeamMeetingCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingResponse:
    meeting = await service.create_team_meeting(
        db,
        owner_id=current_user.id,
        project_id=payload.project_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        participant_ids=payload.participant_ids,
        locale=locale,
    )
    resp = MeetingResponse.model_validate(meeting)
    resp.participants = (await service.participants_map(db, [meeting])).get(meeting.id, [])
    return resp


@router.get("", response_model=list[MeetingResponse], summary="List my confirmed meetings")
async def list_meetings(
    project_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[MeetingResponse]:
    meetings = await service.list_meetings(db, current_user.id, project_id, locale)
    parts = await service.participants_map(db, meetings)
    result = []
    for m in meetings:
        resp = MeetingResponse.model_validate(m)
        resp.participants = parts.get(m.id, [])
        result.append(resp)
    return result


@router.get("/{meeting_id}", response_model=MeetingResponse, summary="Get a meeting")
async def get_meeting(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingResponse:
    meeting = await service.get_meeting(db, meeting_id, current_user.id, locale)
    resp = MeetingResponse.model_validate(meeting)
    resp.participants = (await service.participants_map(db, [meeting])).get(meeting.id, [])
    return resp


@router.get(
    "/{meeting_id}/join",
    response_model=MeetingJoinResponse,
    summary="Get a personalised join link that carries the caller's name",
)
async def join_meeting(
    meeting_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> MeetingJoinResponse:
    url, ends_at = await service.create_meeting_join_link(db, meeting_id, current_user.id, locale)
    return MeetingJoinResponse(url=url, ends_at=ends_at)


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
