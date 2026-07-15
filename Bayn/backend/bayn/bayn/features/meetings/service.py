"""Meetings service — request/accept/reject/cancel a meeting, attendance tracking.

Scheduling is owned by us, not Cal.com: a member proposes a time, the project
owner accepts or rejects it. Cal.com booking is best-effort (calendar sync
only, against one shared event type — no per-user OAuth / Google Calendar
connection); Daily.co room creation is the part that actually needs to
succeed.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from bayn.core.config import settings
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import User
from bayn.features.meetings.models import (
    AttendanceStatus,
    Meeting,
    MeetingAttendance,
    MeetingRequest,
    MeetingRequestStatus,
)
from bayn.features.meetings.schemas import (
    JoinRequestCreate,
    MeetingAttendanceUpdate,
    MeetingRequestCreate,
    ParticipantInfo,
    RequesterInfo,
)
from bayn.integrations.storage.cloudflare import StorageError, r2_client
from bayn.features.projects.models import (
    Project,
    ProjectMeetingSlot,
    ProjectMembership,
    ProjectMembershipRole,
    SlotStatus,
)
from bayn.features.projects.service import MAX_MEMBERSHIPS_PER_USER
from bayn.integrations.cal import CalComError, calcom_client
from bayn.integrations.daily import DailyError, daily_client

logger = logging.getLogger(__name__)

MEETING_REQUEST_TTL = timedelta(days=7)
MAX_MEETINGS_PER_DAY = 3
# How early participants may enter the video room before the meeting starts.
JOIN_WINDOW = timedelta(minutes=5)


def _ensure_aware(dt: datetime) -> datetime:
    # SQLite (tests) drops tzinfo on round-trip; Postgres preserves it
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _day_bounds_utc(dt: datetime) -> tuple[datetime, datetime]:
    start = _ensure_aware(dt).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


async def _get_owner_membership(db: AsyncSession, project_id: uuid.UUID, locale: str) -> ProjectMembership:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.role == ProjectMembershipRole.OWNER
        )
    )
    if not membership:
        raise NotFoundError(t("meetings", "request.project_not_found", locale))
    return membership


async def _require_member(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str) -> None:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if not membership or membership.role != ProjectMembershipRole.MEMBER:
        raise ForbiddenError(t("meetings", "request.member_only", locale))


# ── Meeting requests ────────────────────────────────────────────────────────

async def create_meeting_request(
    db: AsyncSession, requester_id: uuid.UUID, payload: MeetingRequestCreate, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    project = await db.get(Project, payload.project_id)
    if not project:
        raise NotFoundError(t("meetings", "request.project_not_found", locale))

    owner_membership = await _get_owner_membership(db, project.id, locale)
    if owner_membership.user_id == requester_id:
        raise ValidationError(t("meetings", "request.owner_cannot_request_self", locale))

    await _require_member(db, project.id, requester_id, locale)

    if payload.proposed_end_time <= payload.proposed_start_time:
        raise ValidationError(t("meetings", "request.invalid_time_range", locale))
    if payload.proposed_start_time <= datetime.now(timezone.utc):
        raise ValidationError(t("meetings", "request.time_in_past", locale))

    request = MeetingRequest(
        requester_id=requester_id,
        owner_id=owner_membership.user_id,
        project_id=project.id,
        proposed_start_time=payload.proposed_start_time,
        proposed_end_time=payload.proposed_end_time,
        message=payload.message,
        expires_at=datetime.now(timezone.utc) + MEETING_REQUEST_TTL,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def create_join_request(
    db: AsyncSession, requester_id: uuid.UUID, payload: JoinRequestCreate, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    # A joiner (not yet a member) picks a published slot. Accepting this both
    # adds them to the project and schedules the meeting.
    project = await db.get(Project, payload.project_id)
    if not project:
        raise NotFoundError(t("meetings", "request.project_not_found", locale))

    owner_membership = await _get_owner_membership(db, project.id, locale)
    if owner_membership.user_id == requester_id:
        raise ValidationError(t("meetings", "join.owner_cannot_join", locale))

    already_member = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project.id, ProjectMembership.user_id == requester_id
        )
    )
    if already_member:
        raise ConflictError(t("meetings", "join.already_member", locale))

    slot = await db.get(ProjectMeetingSlot, payload.slot_id)
    if not slot or slot.project_id != project.id:
        raise NotFoundError(t("meetings", "join.slot_not_found", locale))
    if slot.status != SlotStatus.available or _ensure_aware(slot.start_time) <= datetime.now(timezone.utc):
        raise ConflictError(t("meetings", "join.slot_taken", locale))

    duplicate = await db.scalar(
        select(MeetingRequest).where(
            MeetingRequest.project_id == project.id,
            MeetingRequest.requester_id == requester_id,
            MeetingRequest.status == MeetingRequestStatus.pending,
        )
    )
    if duplicate:
        raise ConflictError(t("meetings", "join.already_requested", locale))

    request = MeetingRequest(
        requester_id=requester_id,
        owner_id=owner_membership.user_id,
        project_id=project.id,
        proposed_start_time=slot.start_time,
        proposed_end_time=slot.end_time,
        message=payload.message,
        slot_id=slot.id,
        expires_at=datetime.now(timezone.utc) + MEETING_REQUEST_TTL,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


def _participant_info(user: User) -> ParticipantInfo:
    avatar_url = None
    if user.avatar_key:
        try:
            avatar_url = r2_client.get_avatar_url(user.avatar_key)
        except StorageError:
            avatar_url = None
    return ParticipantInfo(
        id=user.id,
        name_en=f"{user.first_name_en} {user.last_name_en}".strip(),
        name_ar=f"{user.first_name_ar} {user.last_name_ar}".strip(),
        avatar_url=avatar_url,
    )


async def participants_map(db: AsyncSession, meetings) -> dict[uuid.UUID, list[ParticipantInfo]]:
    # The two participants (requester + owner) of each meeting, with avatars.
    ids = set()
    for m in meetings:
        ids.add(m.user_id)
        ids.add(m.counterpart_id)
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    users = {u.id: _participant_info(u) for u in result.scalars().all()}
    out = {}
    for m in meetings:
        out[m.id] = [users[uid] for uid in (m.user_id, m.counterpart_id) if uid in users]
    return out


def _location(user: User, arabic: bool) -> str | None:
    """Build a display location like "Riyadh, Saudi Arabia" from the user's
    city/country. Returns None when the user set neither."""
    parts = []
    if user.city is not None:
        parts.append(user.city.name_ar if arabic else user.city.name_en)
    if user.country is not None:
        parts.append(user.country.name_ar if arabic else user.country.name_en)
    if not parts:
        return None
    return ("، " if arabic else ", ").join(parts)


async def requesters_map(db: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, RequesterInfo]:
    # Basic public info for each requester, keyed by user id (for the owner's
    # incoming-requests view).
    ids = list({uid for uid in user_ids})
    if not ids:
        return {}
    # city/country are eager-loaded — a lazy load here would raise MissingGreenlet
    # under async SQLAlchemy.
    result = await db.execute(
        select(User)
        .options(selectinload(User.city), selectinload(User.country))
        .where(User.id.in_(ids))
    )
    out = {}
    for user in result.scalars().all():
        out[user.id] = RequesterInfo(
            id=user.id,
            name_en=f"{user.first_name_en} {user.last_name_en}".strip(),
            name_ar=f"{user.first_name_ar} {user.last_name_ar}".strip(),
            job_title=user.job_title,
            location_en=_location(user, arabic=False),
            location_ar=_location(user, arabic=True),
        )
    return out


async def get_meeting_request(db: AsyncSession, request_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> MeetingRequest:
    request = await db.get(MeetingRequest, request_id)
    if not request:
        raise NotFoundError(t("meetings", "request.not_found", locale))
    return request


async def list_meeting_requests(
    db: AsyncSession, user_id: uuid.UUID, role: str, project_id: uuid.UUID | None = None
) -> list[MeetingRequest]:
    # role "incoming": requests addressed to this user as project owner
    # role "outgoing": requests this user sent as a member
    column = MeetingRequest.owner_id if role == "incoming" else MeetingRequest.requester_id
    query = select(MeetingRequest).where(column == user_id).order_by(MeetingRequest.created_at.desc())
    if project_id is not None:
        query = query.where(MeetingRequest.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


async def _count_meetings_on_day(
    db: AsyncSession, user_id: uuid.UUID, day_start: datetime, day_end: datetime
) -> int:
    result = await db.execute(
        select(func.count()).select_from(Meeting).where(
            Meeting.user_id == user_id, Meeting.start_time >= day_start, Meeting.start_time < day_end
        )
    )
    return result.scalar_one()


def _english_full_name(user: User) -> str:
    # Cal.com attendee name — English name only, no locale concept on their side
    return f"{user.first_name_en} {user.last_name_en}"


# durations enabled on the shared "cal-event" Cal.com event type
# (CALCOM_EVENT_TYPE_ID) — Cal.com rejects any lengthInMinutes not in this set
_CALCOM_LENGTH_OPTIONS = (15, 30, 45, 60)


def _round_to_calcom_length(request: MeetingRequest) -> int:
    actual_minutes = (request.proposed_end_time - request.proposed_start_time).total_seconds() / 60
    return min(_CALCOM_LENGTH_OPTIONS, key=lambda option: abs(option - actual_minutes))


async def _try_create_calcom_booking(
    db: AsyncSession, request: MeetingRequest
) -> str | None:
    # best-effort calendar sync against one shared event type (no per-user
    # OAuth / Google Calendar connection — see module docstring). A failure
    # here must never block accepting the meeting; Daily.co is the part that
    # actually needs to succeed.
    if not settings.CALCOM_EVENT_TYPE_ID:
        return None

    requester = await db.get(User, request.requester_id)
    if requester is None:
        return None

    try:
        booking = await calcom_client.create_booking(
            event_type_id=settings.CALCOM_EVENT_TYPE_ID,
            start_time=_ensure_aware(request.proposed_start_time).isoformat(),
            attendee_email=requester.email,
            attendee_name=_english_full_name(requester),
            length_minutes=_round_to_calcom_length(request),
        )
    except CalComError:
        logger.warning("Cal.com booking failed for meeting request %s", request.id, exc_info=True)
        return None

    data = booking.get("data", booking)
    return data.get("uid") or data.get("id")


async def _has_prior_meeting(
    db: AsyncSession, user_id: uuid.UUID, counterpart_id: uuid.UUID, project_id: uuid.UUID
) -> bool:
    existing = await db.scalar(
        select(Meeting.id).where(
            Meeting.project_id == project_id,
            Meeting.user_id == user_id,
            Meeting.counterpart_id == counterpart_id,
        ).limit(1)
    )
    return existing is not None


async def accept_meeting_request(
    db: AsyncSession, request_id: uuid.UUID, owner_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> Meeting:
    request = await get_meeting_request(db, request_id, locale)
    if request.owner_id != owner_id:
        raise ForbiddenError(t("meetings", "request.not_addressed_to_you", locale))

    if request.status != MeetingRequestStatus.pending:
        raise ValidationError(t("meetings", "request.not_pending", locale))

    if _ensure_aware(request.expires_at) < datetime.now(timezone.utc):
        request.status = MeetingRequestStatus.expired
        await db.commit()
        raise ValidationError(t("meetings", "request.expired", locale))

    day_start, day_end = _day_bounds_utc(request.proposed_start_time)
    if await _count_meetings_on_day(db, request.requester_id, day_start, day_end) >= MAX_MEETINGS_PER_DAY:
        raise ConflictError(t("meetings", "request.daily_limit_reached", locale))

    # If the requester isn't a member yet, approving also adds them (the join
    # flow) — enforce the membership cap and add them before attendance is built.
    already_member = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == request.project_id,
            ProjectMembership.user_id == request.requester_id,
        )
    )
    if not already_member:
        count = await db.scalar(
            select(func.count()).select_from(ProjectMembership).where(
                ProjectMembership.user_id == request.requester_id
            )
        )
        if count >= MAX_MEMBERSHIPS_PER_USER:
            raise ConflictError(t("meetings", "join.limit_reached", locale))
        db.add(ProjectMembership(
            user_id=request.requester_id,
            project_id=request.project_id,
            role=ProjectMembershipRole.MEMBER,
        ))
        await db.flush()

    project = await db.get(Project, request.project_id)
    is_initial = not await _has_prior_meeting(db, request.requester_id, request.owner_id, request.project_id)

    room_name = f"meeting-{uuid.uuid4().hex}"
    exp = int(_ensure_aware(request.proposed_end_time).timestamp()) + 3600
    nbf = int((_ensure_aware(request.proposed_start_time) - JOIN_WINDOW).timestamp())
    try:
        room = await daily_client.create_room(
            name=room_name,
            exp_epoch_seconds=exp,
            nbf_epoch_seconds=nbf,
        )
    except DailyError:
        raise ValidationError(t("meetings", "request.room_creation_failed", locale))

    calcom_booking_id = await _try_create_calcom_booking(db, request)

    meeting = Meeting(
        user_id=request.requester_id,
        counterpart_id=request.owner_id,
        project_id=request.project_id,
        title=project.title if project else None,
        start_time=request.proposed_start_time,
        end_time=request.proposed_end_time,
        is_initial_meeting=is_initial,
        calcom_booking_id=calcom_booking_id,
        video_link=room.get("url"),
    )
    db.add(meeting)
    await db.flush()

    request.status = MeetingRequestStatus.accepted
    request.resulting_meeting_id = meeting.id

    # A picked slot is consumed once the meeting is confirmed.
    if request.slot_id is not None:
        slot = await db.get(ProjectMeetingSlot, request.slot_id)
        if slot:
            slot.status = SlotStatus.taken

    memberships = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == request.project_id,
            ProjectMembership.user_id.in_([request.requester_id, request.owner_id]),
        )
    )
    for membership in memberships.scalars().all():
        db.add(MeetingAttendance(meeting_id=meeting.id, membership_id=membership.id))

    await db.commit()
    await db.refresh(meeting)
    return meeting


async def reject_meeting_request(
    db: AsyncSession, request_id: uuid.UUID, owner_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    request = await get_meeting_request(db, request_id, locale)
    if request.owner_id != owner_id:
        raise ForbiddenError(t("meetings", "request.not_addressed_to_you", locale))
    if request.status != MeetingRequestStatus.pending:
        raise ValidationError(t("meetings", "request.not_pending", locale))

    request.status = MeetingRequestStatus.rejected
    await db.commit()
    await db.refresh(request)
    return request


async def cancel_meeting_request(
    db: AsyncSession, request_id: uuid.UUID, requester_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    request = await get_meeting_request(db, request_id, locale)
    if request.requester_id != requester_id:
        raise ForbiddenError(t("meetings", "request.not_your_request", locale))
    if request.status != MeetingRequestStatus.pending:
        raise ValidationError(t("meetings", "request.not_pending", locale))

    request.status = MeetingRequestStatus.cancelled
    await db.commit()
    await db.refresh(request)
    return request


# ── Meetings ────────────────────────────────────────────────────────────────

async def get_meeting(
    db: AsyncSession, meeting_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> Meeting:
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise NotFoundError(t("meetings", "meeting.not_found", locale))
    if user_id not in (meeting.user_id, meeting.counterpart_id):
        raise ForbiddenError(t("meetings", "meeting.not_a_participant", locale))
    return meeting


async def list_meetings(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID | None = None
) -> list[Meeting]:
    query = (
        select(Meeting)
        .where(or_(Meeting.user_id == user_id, Meeting.counterpart_id == user_id))
        .order_by(Meeting.start_time.desc())
    )
    if project_id is not None:
        query = query.where(Meeting.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


# ── Attendance ──────────────────────────────────────────────────────────────

async def update_attendance(
    db: AsyncSession,
    meeting_id: uuid.UUID,
    actor_id: uuid.UUID,
    payload: MeetingAttendanceUpdate,
    locale: str = DEFAULT_LOCALE,
) -> MeetingAttendance:
    meeting = await get_meeting(db, meeting_id, actor_id, locale)  # 404/403 if not a participant

    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == meeting.project_id, ProjectMembership.user_id == actor_id
        )
    )
    attendance = membership and await db.scalar(
        select(MeetingAttendance).where(
            MeetingAttendance.meeting_id == meeting_id, MeetingAttendance.membership_id == membership.id
        )
    )
    if not attendance:
        raise NotFoundError(t("meetings", "attendance.not_found", locale))

    attendance.status = payload.status
    if payload.status in (AttendanceStatus.present, AttendanceStatus.late) and attendance.joined_at is None:
        attendance.joined_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(attendance)
    return attendance
