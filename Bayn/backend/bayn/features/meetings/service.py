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
from bayn.features.contracts import service as contracts_service
from bayn.features.contracts.models import Contract, ContractStatus
from bayn.features.identity.models import User
from bayn.features.meetings.models import (
    ACTIVE_REQUEST_STATUSES,
    SCHEDULED_STATUSES,
    AttendanceStatus,
    Meeting,
    MeetingAttendance,
    MeetingParticipant,
    MeetingRequest,
    MeetingRequestStatus,
)
from bayn.features.meetings.schemas import (
    JoinRequestCreate,
    MeetingAttendanceUpdate,
    MeetingRequestCreate,
    ParticipantInfo,
    RequesterInfo,
    SignatureState,
)
from bayn.features.notifications import service as notifications_service
from bayn.features.notifications.models import NotificationType
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
# Daily.co/Cal.com's own limits.
MAX_CONCURRENT_MEETINGS_PLATFORM = 3
# How early participants may enter the video room before the meeting starts.
JOIN_WINDOW = timedelta(minutes=5)


async def _count_overlapping_meetings(db: AsyncSession, start: datetime, end: datetime) -> int:
    result = await db.execute(
        select(func.count()).select_from(Meeting).where(
            Meeting.start_time < end, Meeting.end_time > start,
        )
    )
    return result.scalar_one()


def _ensure_aware(dt: datetime) -> datetime:
    # SQLite (tests) drops tzinfo on round-trip; Postgres preserves it
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _notification_data(actor: User, project: Project | None, **extra) -> dict:
    return {
        "actor_name_en": f"{actor.first_name_en} {actor.last_name_en}".strip(),
        "actor_name_ar": f"{actor.first_name_ar} {actor.last_name_ar}".strip(),
        "project_title": project.title if project else "",
        **extra,
    }


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

    requester = await db.get(User, requester_id)
    notifications_service.create_notification(
        db, owner_membership.user_id, NotificationType.meeting_request_received,
        _notification_data(requester, project, project_id=str(project.id), meeting_request_id=str(request.id)),
    )

    await db.commit()
    await db.refresh(request)
    return request


async def create_join_request(
    db: AsyncSession, requester_id: uuid.UUID, payload: JoinRequestCreate, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    # A joiner (not yet a member) picks a published slot. Accepting this sends
    # both parties an NDA; the meeting follows once they've signed, and
    # membership only if the owner approves them afterwards.
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

    # Any request still in flight blocks another, not just a pending one: the
    # requester stays a non-member until the very end of the flow, so the
    # already_member check above can't be what stops them taking a second slot.
    duplicate = await db.scalar(
        select(MeetingRequest).where(
            MeetingRequest.project_id == project.id,
            MeetingRequest.requester_id == requester_id,
            MeetingRequest.status.in_(ACTIVE_REQUEST_STATUSES),
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

    requester = await db.get(User, requester_id)
    notifications_service.create_notification(
        db, owner_membership.user_id, NotificationType.meeting_request_received,
        _notification_data(requester, project, project_id=str(project.id), meeting_request_id=str(request.id)),
    )

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
    # Everyone in each meeting, with avatars. The legacy user_id/counterpart_id
    # pair plus any extra rows in meeting_participants (team meetings, same-slot
    # applicant meetings), de-duplicated and kept in a stable order.
    meeting_ids = [m.id for m in meetings]
    if not meeting_ids:
        return {}

    per_meeting: dict[uuid.UUID, list[uuid.UUID]] = {}
    for m in meetings:
        per_meeting[m.id] = [uid for uid in (m.user_id, m.counterpart_id) if uid]

    extra = await db.execute(
        select(MeetingParticipant.meeting_id, MeetingParticipant.user_id)
        .where(MeetingParticipant.meeting_id.in_(meeting_ids))
        .order_by(MeetingParticipant.created_at)
    )
    for meeting_id, uid in extra.all():
        per_meeting.setdefault(meeting_id, []).append(uid)

    ids = {uid for uids in per_meeting.values() for uid in uids}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    users = {u.id: _participant_info(u) for u in result.scalars().all()}

    out = {}
    for m in meetings:
        seen = set()
        ordered = []
        for uid in per_meeting.get(m.id, []):
            if uid in users and uid not in seen:
                seen.add(uid)
                ordered.append(users[uid])
        out[m.id] = ordered
    return out


async def signature_map(db: AsyncSession, requests) -> dict[uuid.UUID, SignatureState]:
    """Per-request NDA signing progress, keyed by request id.

    Only requests actually waiting on signatures get an entry — before accept
    there's no contract, and after scheduling everyone has signed by
    definition, so a state would be noise either way.
    """
    ids = [r.id for r in requests if r.status == MeetingRequestStatus.awaiting_signatures]
    if not ids:
        return {}

    contracts = await db.execute(select(Contract).where(Contract.meeting_request_id.in_(ids)))
    out = {}
    for contract in contracts.scalars().all():
        # Signature-System reports one status, not a flag per party: it walks
        # pending_party_one -> pending_party_two -> signed, so party one having
        # signed is implied by having moved past their step. The owner is
        # party one (see contracts.service.create_nda_for_request).
        out[contract.meeting_request_id] = SignatureState(
            owner_signed=contract.status != ContractStatus.pending_party_one,
            requester_signed=contract.status == ContractStatus.signed,
        )
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
            specialization_id=user.specialization_id,
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
    """How many of the user's meetings that day are booked or on their way there.

    Requests out for signature count: they turn into meetings on their own once
    signed, so ignoring them would let an owner accept an unlimited number for
    one day and have them all land at once.
    """
    scheduled = await db.scalar(
        select(func.count()).select_from(Meeting).where(
            Meeting.user_id == user_id, Meeting.start_time >= day_start, Meeting.start_time < day_end
        )
    )
    awaiting = await db.scalar(
        select(func.count()).select_from(MeetingRequest).where(
            MeetingRequest.requester_id == user_id,
            MeetingRequest.status == MeetingRequestStatus.awaiting_signatures,
            MeetingRequest.proposed_start_time >= day_start,
            MeetingRequest.proposed_start_time < day_end,
        )
    )
    return scheduled + awaiting


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
    db: AsyncSession,
    request_id: uuid.UUID,
    owner_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
    meeting_title: str | None = None,
) -> MeetingRequest:
    """Owner takes the proposed slot. This does not schedule anything.

    It creates the NDA and hands it to Signature-System, which emails both
    parties a signing link. The meeting is only built once both have signed —
    see `refresh_request_state`. Membership waits until after the meeting, for
    the owner's final call in `finalize_meeting_request`.
    """
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

    await contracts_service.create_nda_for_request(db, request, locale)

    # Remember the owner's chosen meeting title (if any); used when the meeting
    # is built after signing.
    title = (meeting_title or "").strip()
    request.meeting_title = title or None

    request.status = MeetingRequestStatus.awaiting_signatures

    # The slot is held from here, not from the meeting: leaving it available
    # while the NDA is out for signature would let a second joiner take the
    # time the owner already committed to.
    if request.slot_id is not None:
        slot = await db.get(ProjectMeetingSlot, request.slot_id)
        if slot:
            slot.status = SlotStatus.taken

    owner = await db.get(User, owner_id)
    project = await db.get(Project, request.project_id)
    notifications_service.create_notification(
        db, request.requester_id, NotificationType.meeting_request_accepted,
        _notification_data(owner, project, project_id=str(request.project_id), meeting_request_id=str(request.id)),
    )

    await db.commit()
    await db.refresh(request)
    return request


async def _schedule_meeting(
    db: AsyncSession, request: MeetingRequest, locale: str = DEFAULT_LOCALE
) -> Meeting:
    """Build the actual meeting for a request whose NDA is fully signed.

    Callers must have checked the signatures — this doesn't re-check. Flushes
    but doesn't commit; the caller owns the transaction.
    """
    project = await db.get(Project, request.project_id)

    # Same-slot folding: if another applicant already turned this exact slot into
    # a meeting, join that one instead of creating a second. A non-signer never
    # blocks the others, and a late signer lands here too, joining after the fact.
    if request.slot_id is not None:
        existing = await db.scalar(
            select(Meeting).where(
                Meeting.project_id == request.project_id,
                Meeting.slot_id == request.slot_id,
            )
        )
        if existing is not None:
            request.status = MeetingRequestStatus.scheduled
            request.resulting_meeting_id = existing.id

            contract = await contracts_service.get_contract_for_request(db, request.id)
            if contract is not None:
                contract.meeting_id = existing.id

            already_in = await db.scalar(
                select(MeetingParticipant.id).where(
                    MeetingParticipant.meeting_id == existing.id,
                    MeetingParticipant.user_id == request.requester_id,
                )
            )
            if not already_in:
                db.add(MeetingParticipant(
                    meeting_id=existing.id, user_id=request.requester_id, is_host=False
                ))

            owner = await db.get(User, request.owner_id)
            notifications_service.create_notification(
                db, request.requester_id, NotificationType.meeting_scheduled,
                _notification_data(
                    owner, project,
                    project_id=str(request.project_id), meeting_request_id=str(request.id),
                    meeting_id=str(existing.id),
                ),
            )
            return existing

    is_initial = not await _has_prior_meeting(db, request.requester_id, request.owner_id, request.project_id)

    overlapping = await _count_overlapping_meetings(
        db, _ensure_aware(request.proposed_start_time), _ensure_aware(request.proposed_end_time)
    )
    if overlapping >= MAX_CONCURRENT_MEETINGS_PLATFORM:
        # ValidationError, not ConflictError: this runs inside refresh_request_state's
        # best-effort retry (only catches ValidationError, same as room_creation_failed) —
        # a ConflictError here would escape and break the read that triggered it.
        raise ValidationError(t("meetings", "capacity.platform_full", locale))

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

    # The meeting title always ends with the project name so members can tell
    # which project it belongs to: "<owner's title> - <project>". With no custom
    # title it's just the project name.
    project_title = project.title if project else None
    if request.meeting_title and project_title:
        meeting_title = f"{request.meeting_title} - {project_title}"
    else:
        meeting_title = request.meeting_title or project_title

    meeting = Meeting(
        user_id=request.requester_id,
        counterpart_id=request.owner_id,
        project_id=request.project_id,
        slot_id=request.slot_id,
        title=meeting_title,
        start_time=request.proposed_start_time,
        end_time=request.proposed_end_time,
        is_initial_meeting=is_initial,
        calcom_booking_id=calcom_booking_id,
        video_link=room.get("url"),
    )
    db.add(meeting)
    await db.flush()

    request.status = MeetingRequestStatus.scheduled
    request.resulting_meeting_id = meeting.id

    contract = await contracts_service.get_contract_for_request(db, request.id)
    if contract is not None:
        contract.meeting_id = meeting.id

    # Unified participant list: the owner hosts, the requester attends. Further
    # applicants who signed for the same slot get appended in the fold above.
    db.add(MeetingParticipant(meeting_id=meeting.id, user_id=request.owner_id, is_host=True))
    db.add(MeetingParticipant(meeting_id=meeting.id, user_id=request.requester_id, is_host=False))

    # Only the owner has a membership at this point — the requester earns theirs
    # after the meeting — so this builds the one attendance row it can. The
    # requester's is added by finalize_meeting_request if they're approved.
    memberships = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == request.project_id,
            ProjectMembership.user_id.in_([request.requester_id, request.owner_id]),
        )
    )
    for membership in memberships.scalars().all():
        db.add(MeetingAttendance(meeting_id=meeting.id, membership_id=membership.id))

    owner = await db.get(User, request.owner_id)
    requester = await db.get(User, request.requester_id)
    notify_data = {"project_id": str(request.project_id), "meeting_request_id": str(request.id), "meeting_id": str(meeting.id)}
    notifications_service.create_notification(
        db, request.owner_id, NotificationType.meeting_scheduled,
        _notification_data(requester, project, **notify_data),
    )
    notifications_service.create_notification(
        db, request.requester_id, NotificationType.meeting_scheduled,
        _notification_data(owner, project, **notify_data),
    )

    return meeting


async def refresh_request_state(
    db: AsyncSession, request: MeetingRequest, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    """Pull the NDA's signing status and schedule the meeting if it's complete.

    This is what makes "everyone signed -> the meeting appears" happen without a
    background worker: it runs whenever a request is read, and on the webhook
    Signature-System calls. Best-effort by design — a Signature-System or
    Daily.co outage leaves the request awaiting signatures rather than failing
    the read that triggered it.
    """
    if request.status != MeetingRequestStatus.awaiting_signatures:
        return request

    # Nobody can sign an NDA for a meeting whose time has already passed, so the
    # request is dead and the slot it was holding goes back on the market.
    if _ensure_aware(request.proposed_start_time) < datetime.now(timezone.utc):
        request.status = MeetingRequestStatus.expired
        await _release_slot(db, request)
        await db.commit()
        await db.refresh(request)
        return request

    contract = await contracts_service.get_contract_for_request(db, request.id)
    if contract is None:
        return request

    await contracts_service.sync_contract(db, contract)
    if contract.status != ContractStatus.signed:
        await db.commit()
        return request

    try:
        # A savepoint, not a plain try: rolling the whole session back here would
        # expire every object the caller is holding — this runs in a loop over a
        # list the router is about to serialise, and an expired row would lazy
        # load mid-serialisation and blow up the entire response. Only the
        # half-built meeting is discarded; the signature sync above survives.
        async with db.begin_nested():
            await _schedule_meeting(db, request, locale)
    except ValidationError:
        # Room creation failed. The NDA is still signed and that's worth keeping,
        # so the next read retries scheduling against a healthy Daily.co.
        logger.warning("Scheduling failed for signed request %s", request.id, exc_info=True)

    await db.commit()
    await db.refresh(request)
    return request


async def finalize_meeting_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    owner_id: uuid.UUID,
    approve: bool,
    locale: str = DEFAULT_LOCALE,
) -> MeetingRequest:
    """The owner's call after the meeting: approving registers the requester as
    a project member, declining leaves them out."""
    request = await get_meeting_request(db, request_id, locale)
    if request.owner_id != owner_id:
        raise ForbiddenError(t("meetings", "request.not_addressed_to_you", locale))

    if request.status not in SCHEDULED_STATUSES:
        raise ValidationError(t("meetings", "request.not_scheduled", locale))

    # There is nothing to judge until the meeting has actually happened.
    if _ensure_aware(request.proposed_end_time) > datetime.now(timezone.utc):
        raise ValidationError(t("meetings", "request.meeting_not_over", locale))

    if not approve:
        request.status = MeetingRequestStatus.declined
        request.decided_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(request)
        return request

    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == request.project_id,
            ProjectMembership.user_id == request.requester_id,
        )
    )
    if membership is None:
        # Checked here rather than at accept time: the cap is on memberships, and
        # this is the first moment one is actually granted.
        count = await db.scalar(
            select(func.count()).select_from(ProjectMembership).where(
                ProjectMembership.user_id == request.requester_id
            )
        )
        if count >= MAX_MEMBERSHIPS_PER_USER:
            raise ConflictError(t("meetings", "join.limit_reached", locale))
        membership = ProjectMembership(
            user_id=request.requester_id,
            project_id=request.project_id,
            role=ProjectMembershipRole.MEMBER,
        )
        db.add(membership)
        await db.flush()

    # The attendance row skipped at scheduling time, now that they have a
    # membership to hang it on.
    if request.resulting_meeting_id is not None:
        existing = await db.scalar(
            select(MeetingAttendance).where(
                MeetingAttendance.meeting_id == request.resulting_meeting_id,
                MeetingAttendance.membership_id == membership.id,
            )
        )
        if existing is None:
            db.add(MeetingAttendance(
                meeting_id=request.resulting_meeting_id, membership_id=membership.id
            ))

    request.status = MeetingRequestStatus.approved
    request.decided_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(request)
    return request


async def reject_meeting_request(
    db: AsyncSession, request_id: uuid.UUID, owner_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    request = await get_meeting_request(db, request_id, locale)
    if request.owner_id != owner_id:
        raise ForbiddenError(t("meetings", "request.not_addressed_to_you", locale))
    if request.status != MeetingRequestStatus.pending:
        raise ValidationError(t("meetings", "request.not_pending", locale))

    request.status = MeetingRequestStatus.rejected

    owner = await db.get(User, owner_id)
    project = await db.get(Project, request.project_id)
    notifications_service.create_notification(
        db, request.requester_id, NotificationType.meeting_request_rejected,
        _notification_data(owner, project, project_id=str(request.project_id), meeting_request_id=str(request.id)),
    )

    await db.commit()
    await db.refresh(request)
    return request


async def _release_slot(db: AsyncSession, request: MeetingRequest) -> None:
    """Hand a held slot back once the request it was held for is dead."""
    if request.slot_id is None:
        return
    slot = await db.get(ProjectMeetingSlot, request.slot_id)
    if slot is not None:
        slot.status = SlotStatus.available


async def cancel_meeting_request(
    db: AsyncSession, request_id: uuid.UUID, requester_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> MeetingRequest:
    request = await get_meeting_request(db, request_id, locale)
    if request.requester_id != requester_id:
        raise ForbiddenError(t("meetings", "request.not_your_request", locale))
    # Withdrawable right up until the meeting exists: a requester who decides
    # not to sign shouldn't be stuck holding the owner's slot. Once both have
    # signed the NDA it's binding and cancelling is no longer theirs to do.
    if request.status not in (MeetingRequestStatus.pending, MeetingRequestStatus.awaiting_signatures):
        raise ValidationError(t("meetings", "request.not_pending", locale))

    if request.status == MeetingRequestStatus.awaiting_signatures:
        await _release_slot(db, request)

    request.status = MeetingRequestStatus.cancelled
    await db.commit()
    await db.refresh(request)
    return request


# ── Meetings ────────────────────────────────────────────────────────────────

async def create_team_meeting(
    db: AsyncSession,
    owner_id: uuid.UUID,
    project_id: uuid.UUID,
    title: str | None,
    start_time: datetime,
    end_time: datetime,
    participant_ids: list[uuid.UUID],
    locale: str = DEFAULT_LOCALE,
) -> Meeting:
    """The owner schedules a meeting for their project and picks which members
    attend. Unlike the request flow this is direct (no NDA): every attendee is
    already a member of the project."""
    project = await db.get(Project, project_id)
    if project is None:
        raise NotFoundError(t("projects", "project.not_found", locale))

    owner_membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == owner_id,
        )
    )
    if not owner_membership or owner_membership.role != ProjectMembershipRole.OWNER:
        raise ForbiddenError(t("meetings", "team.owner_only", locale))

    start = _ensure_aware(start_time)
    end = _ensure_aware(end_time)
    if end <= start:
        raise ValidationError(t("meetings", "team.bad_time_range", locale))
    if start < datetime.now(timezone.utc):
        raise ValidationError(t("meetings", "team.past_time", locale))

    # Selected attendees must be members of this same project (owner excluded —
    # they're added as host regardless).
    selected = [uid for uid in dict.fromkeys(participant_ids) if uid != owner_id]
    if selected:
        rows = await db.execute(
            select(ProjectMembership.user_id).where(
                ProjectMembership.project_id == project_id,
                ProjectMembership.user_id.in_(selected),
            )
        )
        members = {uid for (uid,) in rows.all()}
        if any(uid not in members for uid in selected):
            raise ValidationError(t("meetings", "team.not_a_member", locale))

    overlapping = await _count_overlapping_meetings(db, start, end)
    if overlapping >= MAX_CONCURRENT_MEETINGS_PLATFORM:
        raise ConflictError(t("meetings", "capacity.platform_full", locale))

    room_name = f"meeting-{uuid.uuid4().hex}"
    exp = int(end.timestamp())
    nbf = int((start - JOIN_WINDOW).timestamp())
    try:
        room = await daily_client.create_room(
            name=room_name, exp_epoch_seconds=exp, nbf_epoch_seconds=nbf
        )
    except DailyError:
        raise ValidationError(t("meetings", "request.room_creation_failed", locale))

    custom = (title or "").strip()
    meeting_title = f"{custom} - {project.title}" if custom else project.title

    # counterpart_id == owner: the owner both organises and hosts; the real
    # attendee list lives in meeting_participants.
    meeting = Meeting(
        user_id=owner_id,
        counterpart_id=owner_id,
        project_id=project_id,
        slot_id=None,
        title=meeting_title,
        start_time=start,
        end_time=end,
        is_initial_meeting=False,
        video_link=room.get("url"),
    )
    db.add(meeting)
    await db.flush()

    db.add(MeetingParticipant(meeting_id=meeting.id, user_id=owner_id, is_host=True))
    for uid in selected:
        db.add(MeetingParticipant(meeting_id=meeting.id, user_id=uid, is_host=False))

    # Everyone here already has a membership, so seed an attendance row each.
    member_ids = [owner_id, *selected]
    memberships = await db.execute(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id.in_(member_ids),
        )
    )
    for membership in memberships.scalars().all():
        db.add(MeetingAttendance(meeting_id=meeting.id, membership_id=membership.id))

    owner = await db.get(User, owner_id)
    for uid in selected:
        notifications_service.create_notification(
            db, uid, NotificationType.meeting_scheduled,
            _notification_data(owner, project, project_id=str(project_id), meeting_id=str(meeting.id)),
        )

    await db.commit()
    await db.refresh(meeting)
    return meeting


async def cancel_team_meeting(
    db: AsyncSession, meeting_id: uuid.UUID, owner_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    """The owner cancels a team meeting they scheduled. Scoped to team
    meetings only — 1:1 introduction meetings go through the NDA/contract
    flow and aren't touched here."""
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise NotFoundError(t("meetings", "meeting.not_found", locale))

    if meeting.user_id != meeting.counterpart_id:
        raise ValidationError(t("meetings", "team.not_a_team_meeting", locale))

    if meeting.user_id != owner_id:
        raise ForbiddenError(t("meetings", "team.owner_only", locale))

    await db.delete(meeting)  # cascades to meeting_participants and attendance rows
    await db.commit()


async def get_meeting(
    db: AsyncSession, meeting_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> Meeting:
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise NotFoundError(t("meetings", "meeting.not_found", locale))
    if user_id not in (meeting.user_id, meeting.counterpart_id):
        # Group meetings carry their extra attendees in meeting_participants.
        is_participant = await db.scalar(
            select(MeetingParticipant.id).where(
                MeetingParticipant.meeting_id == meeting_id,
                MeetingParticipant.user_id == user_id,
            )
        )
        if not is_participant:
            raise ForbiddenError(t("meetings", "meeting.not_a_participant", locale))
    return meeting


def _display_name(user: User, locale: str) -> str:
    """The name Daily shows for this participant, in their own language."""
    if locale == "ar":
        name = f"{user.first_name_ar} {user.last_name_ar}".strip()
    else:
        name = f"{user.first_name_en} {user.last_name_en}".strip()
    return name or user.username


async def create_meeting_join_link(
    db: AsyncSession, meeting_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> str:
    """A personalised join URL: the room link plus a Daily token that carries
    the user's platform name, so they join under it without being asked to type
    one (and can't type someone else's).

    The token is minted per click rather than stored: it's short-lived, tied to
    this user, and there's no benefit to reusing it.
    """
    meeting = await get_meeting(db, meeting_id, user_id, locale)  # 404/403 if not a participant
    if not meeting.video_link:
        raise ValidationError(t("meetings", "meeting.no_room", locale))

    user = await db.get(User, user_id)
    # room name is the last path segment of the stored join URL
    room_name = meeting.video_link.rstrip("/").rsplit("/", 1)[-1]
    # match the room's own exp (end + 1h, set in _schedule_meeting) so the token
    # can't outlive the room it opens
    exp = int(_ensure_aware(meeting.end_time).timestamp()) + 3600

    try:
        token = await daily_client.create_meeting_token(
            room_name=room_name,
            user_name=_display_name(user, locale),
            exp_epoch_seconds=exp,
            # the project owner (counterpart) hosts, so they get moderator rights
            is_owner=(user_id == meeting.counterpart_id),
        )
    except DailyError:
        raise ValidationError(t("meetings", "meeting.join_link_failed", locale))

    return f"{meeting.video_link}?t={token}"


async def list_meetings(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID | None = None, locale: str = DEFAULT_LOCALE
) -> list[Meeting]:
    # A request that finished signing is only promoted to a Meeting row by
    # refresh_request_state — normally via the Signature-System webhook, or
    # lazily whenever /meetings/requests is read. A user who signs and goes
    # straight to this page without either of those firing would otherwise
    # see no upcoming meeting, so the same lazy promotion runs here too.
    pending_query = select(MeetingRequest).where(
        MeetingRequest.status == MeetingRequestStatus.awaiting_signatures,
        or_(MeetingRequest.owner_id == user_id, MeetingRequest.requester_id == user_id),
    )
    if project_id is not None:
        pending_query = pending_query.where(MeetingRequest.project_id == project_id)
    pending = await db.execute(pending_query)
    for request in pending.scalars().all():
        await refresh_request_state(db, request, locale)

    # A meeting is "mine" if I'm the legacy pair, or listed among its extra
    # participants (team / same-slot meetings).
    participant_meetings = select(MeetingParticipant.meeting_id).where(
        MeetingParticipant.user_id == user_id
    )
    query = (
        select(Meeting)
        .where(
            or_(
                Meeting.user_id == user_id,
                Meeting.counterpart_id == user_id,
                Meeting.id.in_(participant_meetings),
            )
        )
        .order_by(Meeting.start_time.desc())
    )
    if project_id is not None:
        query = query.where(Meeting.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


async def list_project_meetings(
    db: AsyncSession, project_id: uuid.UUID, viewer_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> list[Meeting]:
    """All of a project's meetings visible to viewer_id, for the project
    calendar. Owner-scheduled team meetings (user_id == counterpart_id) are
    visible to every project member; 1:1 introduction meetings from a join
    request stay private to whoever is actually a party to them."""
    # Note: _require_member above is scoped to "member, not owner" (the
    # request-a-meeting-with-the-owner flow) — the calendar needs any
    # membership, owner included.
    is_member = await db.scalar(
        select(ProjectMembership.id).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == viewer_id
        )
    )
    if not is_member:
        raise ForbiddenError(t("meetings", "request.member_only", locale))

    result = await db.execute(
        select(Meeting).where(Meeting.project_id == project_id).order_by(Meeting.start_time)
    )
    meetings = result.scalars().all()
    if not meetings:
        return []

    meeting_ids = [m.id for m in meetings]
    viewer_rows = await db.execute(
        select(MeetingParticipant.meeting_id).where(
            MeetingParticipant.meeting_id.in_(meeting_ids), MeetingParticipant.user_id == viewer_id
        )
    )
    viewer_participant_meetings = {mid for (mid,) in viewer_rows.all()}

    return [
        m for m in meetings
        if m.user_id == m.counterpart_id
        or viewer_id in (m.user_id, m.counterpart_id)
        or m.id in viewer_participant_meetings
    ]


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
