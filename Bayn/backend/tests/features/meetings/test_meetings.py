"""Meetings feature tests: propose/accept/reject/cancel, the NDA gate before a
meeting exists, the owner's post-meeting call, and attendance."""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from bayn.core.security import create_access_token, hash_password
from bayn.features.identity.models import User
from bayn.integrations.daily import DailyError
from bayn.features.meetings.models import MeetingRequest
from bayn.features.projects.models import (
    Project,
    ProjectMeetingSlot,
    ProjectMembership,
    ProjectMembershipRole,
    ProjectStage,
    SlotStatus,
)


@pytest_asyncio.fixture
async def owner(test_user: User) -> User:
    return test_user


@pytest_asyncio.fixture
async def member(db, test_country) -> User:
    user = User(
        first_name_ar="خالد", last_name_ar="سالم",
        first_name_en="Khaled", last_name_en="Salem",
        birth_date=date(2000, 1, 1),
        email="member@example.com", username="member_test",
        password_hash=hash_password("TestPass123"),
        phone_country_id=test_country.id,
        phone_number=511111111,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def outsider(db, test_country) -> User:
    user = User(
        first_name_ar="سارة", last_name_ar="عبدالله",
        first_name_en="Sarah", last_name_en="Abdullah",
        birth_date=date(2000, 1, 1),
        email="outsider@example.com", username="outsider_test",
        password_hash=hash_password("TestPass123"),
        phone_country_id=test_country.id,
        phone_number=522222222,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


def auth_headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest_asyncio.fixture
async def project(db, owner: User) -> Project:
    proj = Project(title="Test Project", stage=ProjectStage.planning, team_members_needed=3)
    db.add(proj)
    await db.flush()
    db.add(ProjectMembership(user_id=owner.id, project_id=proj.id, role=ProjectMembershipRole.OWNER))
    await db.flush()
    await db.refresh(proj)
    return proj


@pytest_asyncio.fixture
async def project_with_member(db, project: Project, member: User) -> Project:
    db.add(ProjectMembership(user_id=member.id, project_id=project.id, role=ProjectMembershipRole.MEMBER))
    await db.flush()
    return project


def _future(hours: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _request_payload(project_id, start_offset_hours: int = 24) -> dict:
    start = _future(start_offset_hours)
    end = start + timedelta(hours=1)
    return {
        "project_id": str(project_id),
        "proposed_start_time": start.isoformat(),
        "proposed_end_time": end.isoformat(),
        "message": "Let's discuss the project",
    }


async def _schedule_meeting(client, project_id, member, owner, mock_nda, payload=None) -> str:
    """Drive a request all the way to a real meeting: propose, accept, sign.

    Returns the meeting id. Reading the requests list is what notices the NDA
    came back signed, so the GET here isn't incidental.
    """
    create = await client.post(
        "/meetings/requests", headers=auth_headers_for(member), json=payload or _request_payload(project_id)
    )
    request_id = create.json()["id"]
    await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))

    mock_nda.sign("signed")
    listed = await client.get(
        "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
    )
    row = next(r for r in listed.json() if r["id"] == request_id)
    return row["resulting_meeting_id"]


# ═══════════════════════════════════════════════════════
# Meeting Requests
# ═══════════════════════════════════════════════════════

class TestMeetingRequests:

    @pytest.mark.asyncio
    async def test_create_request_success(
        self, client: AsyncClient, project_with_member: Project, member: User
    ):
        response = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["requester_id"] == str(member.id)

    @pytest.mark.asyncio
    async def test_owner_cannot_request_self(self, client: AsyncClient, project: Project, owner: User):
        response = await client.post(
            "/meetings/requests", headers=auth_headers_for(owner), json=_request_payload(project.id)
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_non_member_forbidden(self, client: AsyncClient, project: Project, outsider: User):
        response = await client.post(
            "/meetings/requests", headers=auth_headers_for(outsider), json=_request_payload(project.id)
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_invalid_time_range_rejected(
        self, client: AsyncClient, project_with_member: Project, member: User
    ):
        payload = _request_payload(project_with_member.id)
        payload["proposed_end_time"] = payload["proposed_start_time"]
        response = await client.post("/meetings/requests", headers=auth_headers_for(member), json=payload)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_past_time_rejected(self, client: AsyncClient, project_with_member: Project, member: User):
        payload = _request_payload(project_with_member.id, start_offset_hours=-2)
        response = await client.post("/meetings/requests", headers=auth_headers_for(member), json=payload)
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════
# Accept / Reject / Cancel
# ═══════════════════════════════════════════════════════

class TestMeetingAcceptReject:

    @pytest.mark.asyncio
    async def test_accept_sends_nda_and_schedules_nothing(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]

        response = await client.post(
            f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner)
        )
        assert response.status_code == 201
        assert response.json()["status"] == "awaiting_signatures"
        mock_nda.create_contract.assert_called_once()

        # Nothing is booked until both parties sign.
        mock_daily.create_room.assert_not_called()
        assert response.json()["resulting_meeting_id"] is None

        meetings = await client.get("/meetings", headers=auth_headers_for(member))
        assert meetings.json() == []

    @pytest.mark.asyncio
    async def test_meeting_appears_once_both_parties_sign(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))

        # Party one (the owner) signing alone isn't enough — no one-sided meetings.
        mock_nda.sign("pending_party_two")
        listed = await client.get(
            "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
        )
        assert listed.json()[0]["status"] == "awaiting_signatures"
        assert listed.json()[0]["signatures"] == {"requester_signed": False, "owner_signed": True}
        assert (await client.get("/meetings", headers=auth_headers_for(member))).json() == []

        mock_nda.sign("signed")
        listed = await client.get(
            "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
        )
        assert listed.json()[0]["status"] == "scheduled"

        meetings = (await client.get("/meetings", headers=auth_headers_for(member))).json()
        assert len(meetings) == 1
        assert meetings[0]["video_link"] == "https://bayn.daily.co/test-room"
        assert meetings[0]["user_id"] == str(member.id)
        assert meetings[0]["counterpart_id"] == str(owner.id)
        assert meetings[0]["is_initial_meeting"] is True
        mock_daily.create_room.assert_called_once()

    @pytest.mark.asyncio
    async def test_meeting_appears_on_meetings_page_without_visiting_requests_first(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        """GET /meetings must self-heal a signed-but-not-yet-promoted request —
        not every caller reads /meetings/requests (or gets the webhook) first."""
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        mock_nda.sign("signed")

        meetings = (await client.get("/meetings", headers=auth_headers_for(member))).json()
        assert len(meetings) == 1
        assert meetings[0]["counterpart_id"] == str(owner.id)

    @pytest.mark.asyncio
    async def test_accept_not_owner_forbidden(
        self, client: AsyncClient, project_with_member: Project, member: User, outsider: User, mock_daily, mock_nda,
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]

        response = await client.post(
            f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(outsider)
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_reject_request(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]

        response = await client.post(
            f"/meetings/requests/{request_id}/reject", headers=auth_headers_for(owner)
        )
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

    @pytest.mark.asyncio
    async def test_cancel_request(self, client: AsyncClient, project_with_member: Project, member: User):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]

        response = await client.post(
            f"/meetings/requests/{request_id}/cancel", headers=auth_headers_for(member)
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_daily_meeting_limit_enforced(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        # accept 3 for the same day — the 4th must be rejected. Left unsigned on
        # purpose: pending signatures still count against the day's limit,
        # otherwise they'd all become meetings at once later.
        #
        # Anchored to 09:00 UTC two days out rather than now+30h: the limit is
        # per UTC day, so an offset-based start drifts across midnight depending
        # on the hour the suite runs and the 4th request lands on the next day.
        same_day_start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        for i in range(3):
            payload = _request_payload(project_with_member.id)
            start = same_day_start + timedelta(hours=i)
            payload["proposed_start_time"] = start.isoformat()
            payload["proposed_end_time"] = (start + timedelta(minutes=30)).isoformat()
            create = await client.post("/meetings/requests", headers=auth_headers_for(member), json=payload)
            accept = await client.post(
                f"/meetings/requests/{create.json()['id']}/accept", headers=auth_headers_for(owner)
            )
            assert accept.status_code == 201

        payload = _request_payload(project_with_member.id)
        start = same_day_start + timedelta(hours=5)
        payload["proposed_start_time"] = start.isoformat()
        payload["proposed_end_time"] = (start + timedelta(minutes=30)).isoformat()
        create = await client.post("/meetings/requests", headers=auth_headers_for(member), json=payload)

        response = await client.post(
            f"/meetings/requests/{create.json()['id']}/accept", headers=auth_headers_for(owner)
        )
        assert response.status_code == 409


# ═══════════════════════════════════════════════════════
# Meetings & Attendance
# ═══════════════════════════════════════════════════════

class TestMeetingsAndAttendance:

    @pytest.mark.asyncio
    async def test_list_and_get_meeting(
        self,
        client: AsyncClient,
        project_with_member: Project,
        member: User,
        owner: User,
        outsider: User,
        mock_daily,
        mock_calcom,
        mock_nda,
    ):
        meeting_id = await _schedule_meeting(client, project_with_member.id, member, owner, mock_nda)

        for user in (member, owner):
            listed = await client.get("/meetings", headers=auth_headers_for(user))
            assert listed.status_code == 200
            assert any(m["id"] == meeting_id for m in listed.json())

            got = await client.get(f"/meetings/{meeting_id}", headers=auth_headers_for(user))
            assert got.status_code == 200

        forbidden = await client.get(f"/meetings/{meeting_id}", headers=auth_headers_for(outsider))
        assert forbidden.status_code == 403

    @pytest.mark.asyncio
    async def test_update_own_attendance(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        meeting_id = await _schedule_meeting(client, project_with_member.id, member, owner, mock_nda)

        response = await client.patch(
            f"/meetings/{meeting_id}/attendance",
            headers=auth_headers_for(member),
            json={"status": "present"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "present"
        assert data["joined_at"] is not None

    @pytest.mark.asyncio
    async def test_join_link_carries_a_token(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        meeting_id = await _schedule_meeting(client, project_with_member.id, member, owner, mock_nda)

        response = await client.get(f"/meetings/{meeting_id}/join", headers=auth_headers_for(member))
        assert response.status_code == 200
        # the plain room link plus the personalising token
        assert response.json()["url"] == "https://bayn.daily.co/test-room?t=test-token"

        # the token is minted for whoever asks, under their own name
        args = mock_daily.create_meeting_token.call_args.kwargs
        assert args["room_name"] == "test-room"
        assert args["user_name"] == f"{member.first_name_en} {member.last_name_en}"
        # the requester is not the host, so no moderator rights
        assert args["is_owner"] is False

    @pytest.mark.asyncio
    async def test_owner_gets_moderator_token(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        meeting_id = await _schedule_meeting(client, project_with_member.id, member, owner, mock_nda)
        await client.get(f"/meetings/{meeting_id}/join", headers=auth_headers_for(owner))
        assert mock_daily.create_meeting_token.call_args.kwargs["is_owner"] is True

    @pytest.mark.asyncio
    async def test_non_participant_cannot_get_a_join_link(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User,
        outsider: User, mock_daily, mock_calcom, mock_nda,
    ):
        meeting_id = await _schedule_meeting(client, project_with_member.id, member, owner, mock_nda)
        response = await client.get(f"/meetings/{meeting_id}/join", headers=auth_headers_for(outsider))
        assert response.status_code == 403
        mock_daily.create_meeting_token.assert_not_called()


# ═══════════════════════════════════════════════════════
# Join flow: apply → NDA → meeting → owner's final call
# ═══════════════════════════════════════════════════════

class TestJoinFlow:
    """The whole path an outsider takes to become a member."""

    async def _apply(self, client, db, project: Project, applicant: User) -> str:
        slot = ProjectMeetingSlot(
            project_id=project.id, start_time=_future(24), end_time=_future(25)
        )
        db.add(slot)
        await db.flush()

        create = await client.post(
            "/meetings/join-requests",
            headers=auth_headers_for(applicant),
            json={"project_id": str(project.id), "slot_id": str(slot.id), "message": "I'd like to help"},
        )
        assert create.status_code == 201
        return create.json()["id"]

    async def _members(self, db, project: Project) -> list[uuid.UUID]:
        rows = await db.execute(
            select(ProjectMembership.user_id).where(ProjectMembership.project_id == project.id)
        )
        return list(rows.scalars().all())

    async def _end_the_meeting(self, db, request_id: str) -> None:
        """Drag the meeting into the past so it can be decided on."""
        request = await db.get(MeetingRequest, uuid.UUID(request_id))
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        request.proposed_start_time = past - timedelta(hours=1)
        request.proposed_end_time = past
        await db.flush()

    @pytest.mark.asyncio
    async def test_applicant_is_not_a_member_until_the_owner_says_so(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)

        # Accepting the slot doesn't make them a member...
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        assert outsider.id not in await self._members(db, project)

        # ...and neither does signing and holding the meeting.
        mock_nda.sign("signed")
        await client.get("/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner))
        assert outsider.id not in await self._members(db, project)

        await self._end_the_meeting(db, request_id)
        response = await client.post(
            f"/meetings/requests/{request_id}/finalize",
            headers=auth_headers_for(owner),
            json={"approve": True},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert outsider.id in await self._members(db, project)

    @pytest.mark.asyncio
    async def test_declining_leaves_them_out(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        mock_nda.sign("signed")
        await client.get("/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner))
        await self._end_the_meeting(db, request_id)

        response = await client.post(
            f"/meetings/requests/{request_id}/finalize",
            headers=auth_headers_for(owner),
            json={"approve": False},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "declined"
        assert outsider.id not in await self._members(db, project)

    @pytest.mark.asyncio
    async def test_cannot_decide_before_the_meeting_happens(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        mock_nda.sign("signed")
        await client.get("/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner))

        response = await client.post(
            f"/meetings/requests/{request_id}/finalize",
            headers=auth_headers_for(owner),
            json={"approve": True},
        )
        assert response.status_code == 400
        assert outsider.id not in await self._members(db, project)

    @pytest.mark.asyncio
    async def test_only_the_owner_decides(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User, member: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        mock_nda.sign("signed")
        await client.get("/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner))
        await self._end_the_meeting(db, request_id)

        for impostor in (outsider, member):
            response = await client.post(
                f"/meetings/requests/{request_id}/finalize",
                headers=auth_headers_for(impostor),
                json={"approve": True},
            )
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cannot_hold_two_slots_on_one_project(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User, mock_nda,
    ):
        # They stay a non-member all the way to the owner's final call, so the
        # already-a-member check can't be what stops a second application.
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))

        second = ProjectMeetingSlot(
            project_id=project.id, start_time=_future(48), end_time=_future(49)
        )
        db.add(second)
        await db.flush()

        response = await client.post(
            "/meetings/join-requests",
            headers=auth_headers_for(outsider),
            json={"project_id": str(project.id), "slot_id": str(second.id)},
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_unsigned_nda_gives_the_slot_back_once_its_time_passes(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))
        request = await db.get(MeetingRequest, uuid.UUID(request_id))

        # Nobody signs, and the slot's time comes and goes.
        request.proposed_start_time = datetime.now(timezone.utc) - timedelta(hours=2)
        request.proposed_end_time = datetime.now(timezone.utc) - timedelta(hours=1)
        await db.flush()

        await client.get("/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner))

        await db.refresh(request)
        assert request.status.value == "expired"
        assert (await db.get(ProjectMeetingSlot, request.slot_id)).status == SlotStatus.available

    @pytest.mark.asyncio
    async def test_listing_survives_a_video_provider_outage(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User,
        mock_daily, mock_calcom, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))

        mock_nda.sign("signed")
        mock_daily.create_room = AsyncMock(side_effect=DailyError("daily is down"))

        # One request that can't be scheduled must not take the page down with it.
        listed = await client.get(
            "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
        )
        assert listed.status_code == 200
        assert listed.json()[0]["status"] == "awaiting_signatures"

        # ...and it schedules on the next read once Daily.co is back.
        mock_daily.create_room = AsyncMock(return_value={"url": "https://bayn.daily.co/test-room"})
        listed = await client.get(
            "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
        )
        assert listed.json()[0]["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_withdrawing_frees_the_slot_back_up(
        self, client: AsyncClient, db, project: Project, outsider: User, owner: User, mock_nda,
    ):
        request_id = await self._apply(client, db, project, outsider)
        await client.post(f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner))

        request = await db.get(MeetingRequest, uuid.UUID(request_id))
        assert (await db.get(ProjectMeetingSlot, request.slot_id)).status == SlotStatus.taken

        cancel = await client.post(
            f"/meetings/requests/{request_id}/cancel", headers=auth_headers_for(outsider)
        )
        assert cancel.status_code == 200
        await db.refresh(request)
        assert (await db.get(ProjectMeetingSlot, request.slot_id)).status == SlotStatus.available
