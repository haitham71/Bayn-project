"""Meetings feature tests: propose/accept/reject/cancel + attendance."""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient

from bayn.core.security import create_access_token, hash_password
from bayn.features.identity.models import User
from bayn.features.projects.models import Project, ProjectMembership, ProjectMembershipRole, ProjectStage


@pytest_asyncio.fixture
async def owner(test_user: User) -> User:
    return test_user


@pytest_asyncio.fixture
async def member(db, test_country) -> User:
    user = User(
        first_name_ar="خالد", last_name_ar="سالم",
        first_name_en="Khaled", last_name_en="Salem",
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
    async def test_accept_creates_meeting_with_video_link(
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User, mock_daily
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        request_id = create.json()["id"]

        response = await client.post(
            f"/meetings/requests/{request_id}/accept", headers=auth_headers_for(owner)
        )
        assert response.status_code == 201
        data = response.json()
        assert data["video_link"] == "https://bayn.daily.co/test-room"
        assert data["user_id"] == str(member.id)
        assert data["counterpart_id"] == str(owner.id)
        assert data["is_initial_meeting"] is True
        mock_daily.create_room.assert_called_once()

        listed = await client.get(
            "/meetings/requests", params={"role": "incoming"}, headers=auth_headers_for(owner)
        )
        assert listed.status_code == 200
        assert listed.json()[0]["status"] == "accepted"

    @pytest.mark.asyncio
    async def test_accept_not_owner_forbidden(
        self, client: AsyncClient, project_with_member: Project, member: User, outsider: User, mock_daily
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
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User, mock_daily
    ):
        # book 3 meetings for the same day — the 4th must be rejected
        same_day_start = _future(30)
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
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        accept = await client.post(
            f"/meetings/requests/{create.json()['id']}/accept", headers=auth_headers_for(owner)
        )
        meeting_id = accept.json()["id"]

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
        self, client: AsyncClient, project_with_member: Project, member: User, owner: User, mock_daily
    ):
        create = await client.post(
            "/meetings/requests", headers=auth_headers_for(member), json=_request_payload(project_with_member.id)
        )
        accept = await client.post(
            f"/meetings/requests/{create.json()['id']}/accept", headers=auth_headers_for(owner)
        )
        meeting_id = accept.json()["id"]

        response = await client.patch(
            f"/meetings/{meeting_id}/attendance",
            headers=auth_headers_for(member),
            json={"status": "present"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "present"
        assert data["joined_at"] is not None
