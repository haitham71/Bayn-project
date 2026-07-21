"""Tasks feature tests: create/list/update/delete, the owner/editor vs.
plain-member edit tiers, multi-assignee handling, and the project dashboard
that reads tasks + meetings back out."""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient

from bayn.core.security import create_access_token, hash_password
from bayn.features.identity.models import User
from bayn.features.projects.models import Project, ProjectMembership, ProjectMembershipRole, ProjectStage


def auth_headers_for(user: User) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest_asyncio.fixture
async def owner(test_user: User) -> User:
    return test_user


@pytest_asyncio.fixture
async def member(db, test_country) -> User:
    user = User(
        first_name_ar="فهد", last_name_ar="علي",
        first_name_en="Fahad", last_name_en="Ali",
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


@pytest_asyncio.fixture
async def project(db, owner: User, member: User) -> Project:
    proj = Project(title="Test Project", stage=ProjectStage.planning, team_members_needed=3)
    db.add(proj)
    await db.flush()
    db.add(ProjectMembership(user_id=owner.id, project_id=proj.id, role=ProjectMembershipRole.OWNER))
    db.add(ProjectMembership(user_id=member.id, project_id=proj.id, role=ProjectMembershipRole.MEMBER))
    await db.flush()
    await db.refresh(proj)
    return proj


def _payload(project_id, **overrides) -> dict:
    payload = {"project_id": str(project_id), "title": "Write the spec"}
    payload.update(overrides)
    return payload


class TestCreateTask:

    @pytest.mark.asyncio
    async def test_owner_creates_task(self, client: AsyncClient, project: Project, owner: User):
        response = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Write the spec"
        assert data["status"] == "todo"
        assert data["priority"] == "medium"
        assert data["assigned_to"] == []

    @pytest.mark.asyncio
    async def test_create_task_with_multiple_assignees(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        response = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(owner.id), str(member.id)]),
        )

        assert response.status_code == 201
        assert set(response.json()["assigned_to"]) == {str(owner.id), str(member.id)}

    @pytest.mark.asyncio
    async def test_create_task_rejects_assignee_not_in_project(
        self, client: AsyncClient, project: Project, owner: User,
    ):
        response = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(uuid.uuid4())]),
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_non_editor_member_forbidden(
        self, client: AsyncClient, project: Project, member: User,
    ):
        response = await client.post("/tasks", headers=auth_headers_for(member), json=_payload(project.id))
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_non_member_forbidden(
        self, client: AsyncClient, project: Project, outsider: User,
    ):
        response = await client.post("/tasks", headers=auth_headers_for(outsider), json=_payload(project.id))
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_project_not_found(self, client: AsyncClient, owner: User):
        response = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(uuid.uuid4()))
        assert response.status_code == 404


class TestListTasks:

    @pytest.mark.asyncio
    async def test_list_tasks_for_project(self, client: AsyncClient, project: Project, owner: User):
        await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id, title="A"))
        await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id, title="B"))

        response = await client.get("/tasks", params={"project_id": str(project.id)}, headers=auth_headers_for(owner))

        assert response.status_code == 200
        titles = {t["title"] for t in response.json()}
        assert titles == {"A", "B"}

    @pytest.mark.asyncio
    async def test_list_tasks_filtered_by_status(self, client: AsyncClient, project: Project, owner: User):
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner), json=_payload(project.id, status="done")
        )
        await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id, status="todo"))

        response = await client.get(
            "/tasks", params={"project_id": str(project.id), "status": "done"}, headers=auth_headers_for(owner)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == create.json()["id"]

    @pytest.mark.asyncio
    async def test_list_tasks_forbidden_for_non_member(
        self, client: AsyncClient, project: Project, outsider: User,
    ):
        response = await client.get(
            "/tasks", params={"project_id": str(project.id)}, headers=auth_headers_for(outsider)
        )
        assert response.status_code == 403


class TestUpdateTask:

    @pytest.mark.asyncio
    async def test_owner_updates_title_and_status(self, client: AsyncClient, project: Project, owner: User):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(owner),
            json={"title": "Updated title", "status": "in_progress"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated title"
        assert data["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_update_replaces_assignees(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(owner.id), str(member.id)]),
        )
        task_id = create.json()["id"]

        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(owner), json={"assigned_to": [str(member.id)]}
        )
        assert response.status_code == 200
        assert response.json()["assigned_to"] == [str(member.id)]

        # unchanged assignee (member) must survive being included in both the
        # old and new set — this used to hit a unique-constraint race
        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(owner),
            json={"assigned_to": [str(member.id), str(owner.id)]},
        )
        assert response.status_code == 200
        assert set(response.json()["assigned_to"]) == {str(member.id), str(owner.id)}

        # empty list clears every assignee
        response = await client.put(f"/tasks/{task_id}", headers=auth_headers_for(owner), json={"assigned_to": []})
        assert response.status_code == 200
        assert response.json()["assigned_to"] == []

    @pytest.mark.asyncio
    async def test_update_omitting_assigned_to_leaves_it_untouched(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner), json=_payload(project.id, assigned_to=[str(member.id)])
        )
        task_id = create.json()["id"]

        response = await client.put(f"/tasks/{task_id}", headers=auth_headers_for(owner), json={"title": "Renamed"})

        assert response.status_code == 200
        assert response.json()["assigned_to"] == [str(member.id)]

    @pytest.mark.asyncio
    async def test_update_forbidden_for_non_editor_member(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"title": "Hijacked"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_task_not_found(self, client: AsyncClient, owner: User):
        response = await client.put(
            f"/tasks/{uuid.uuid4()}", headers=auth_headers_for(owner), json={"title": "x"}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_granted_editor_can_update(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        grant = await client.post(
            "/tasks/editors", headers=auth_headers_for(owner),
            json={"project_id": str(project.id), "user_id": str(member.id)},
        )
        assert grant.status_code == 204

        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"title": "Editor edit"}
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Editor edit"

    @pytest.mark.asyncio
    async def test_revoked_editor_loses_access(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        await client.post(
            "/tasks/editors", headers=auth_headers_for(owner),
            json={"project_id": str(project.id), "user_id": str(member.id)},
        )
        await client.delete(f"/tasks/editors/{project.id}/{member.id}", headers=auth_headers_for(owner))

        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"title": "Should fail"}
        )
        assert response.status_code == 403


class TestUpdateTaskAsMember:

    @pytest.mark.asyncio
    async def test_member_can_toggle_status(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.patch(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"status": "done"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "done"

    @pytest.mark.asyncio
    async def test_member_can_push_deadline_later(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        first_due = datetime.now(timezone.utc) + timedelta(days=1)
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, due_date=first_due.isoformat()),
        )
        task_id = create.json()["id"]

        later = (first_due + timedelta(days=1)).isoformat()
        response = await client.patch(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"due_date": later}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_member_cannot_move_deadline_earlier(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        first_due = datetime.now(timezone.utc) + timedelta(days=5)
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, due_date=first_due.isoformat()),
        )
        task_id = create.json()["id"]

        earlier = (first_due - timedelta(days=1)).isoformat()
        response = await client.patch(
            f"/tasks/{task_id}", headers=auth_headers_for(member), json={"due_date": earlier}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_non_member_forbidden(
        self, client: AsyncClient, project: Project, owner: User, outsider: User,
    ):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.patch(
            f"/tasks/{task_id}", headers=auth_headers_for(outsider), json={"status": "done"}
        )
        assert response.status_code == 403


class TestDeleteTask:

    @pytest.mark.asyncio
    async def test_owner_deletes_task(self, client: AsyncClient, project: Project, owner: User):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.delete(f"/tasks/{task_id}", headers=auth_headers_for(owner))
        assert response.status_code == 204

        listed = await client.get(
            "/tasks", params={"project_id": str(project.id)}, headers=auth_headers_for(owner)
        )
        assert listed.json() == []

    @pytest.mark.asyncio
    async def test_delete_forbidden_for_non_editor(
        self, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        create = await client.post("/tasks", headers=auth_headers_for(owner), json=_payload(project.id))
        task_id = create.json()["id"]

        response = await client.delete(f"/tasks/{task_id}", headers=auth_headers_for(member))
        assert response.status_code == 403


class TestTaskEditors:

    @pytest.mark.asyncio
    async def test_grant_forbidden_for_non_owner(
        self, client: AsyncClient, project: Project, member: User, outsider: User,
    ):
        response = await client.post(
            "/tasks/editors", headers=auth_headers_for(member),
            json={"project_id": str(project.id), "user_id": str(outsider.id)},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_grant_requires_target_to_be_a_member(
        self, client: AsyncClient, project: Project, owner: User, outsider: User,
    ):
        response = await client.post(
            "/tasks/editors", headers=auth_headers_for(owner),
            json={"project_id": str(project.id), "user_id": str(outsider.id)},
        )
        assert response.status_code == 403


class TestProjectDashboard:
    """Dashboard reads tasks (with assignees) and meetings back out — covered
    here since it's the main consumer of Task.assigned_to."""

    @pytest.mark.asyncio
    async def test_dashboard_reports_tasks_and_assignees(
        self, db, client: AsyncClient, project: Project, owner: User, member: User,
    ):
        await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(owner.id), str(member.id)]),
        )

        from bayn.features.meetings.models import Meeting
        meeting = Meeting(
            user_id=member.id,
            counterpart_id=owner.id,
            project_id=project.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=2),
            end_time=datetime.now(timezone.utc) + timedelta(days=2, hours=1),
            is_initial_meeting=True,
        )
        db.add(meeting)
        await db.commit()

        from bayn.features.dashboard import service as dashboard_service
        dash = await dashboard_service.get_project_dashboard(db, project.id, owner.id)

        assert dash.total_meetings == 1
        assert dash.total_tasks == 1
        assert {m.id for m in dash.tasks[0].assigned_to} == {owner.id, member.id}
        assert all(m.name_en for m in dash.tasks[0].assigned_to)


class TestTaskAssignedNotifications:

    async def _notifications_for(self, db, user_id):
        from sqlalchemy import select
        from bayn.features.notifications.models import Notification
        result = await db.execute(select(Notification).where(Notification.user_id == user_id))
        return result.scalars().all()

    @pytest.mark.asyncio
    async def test_assignees_notified_on_create(
        self, client: AsyncClient, db, project: Project, owner: User, member: User,
    ):
        await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(member.id)]),
        )

        notifications = await self._notifications_for(db, member.id)
        assert len(notifications) == 1
        assert notifications[0].type.value == "task_assigned"
        assert notifications[0].data["task_title"] == "Write the spec"
        assert notifications[0].data["actor_name_en"] == f"{owner.first_name_en} {owner.last_name_en}"

    @pytest.mark.asyncio
    async def test_assigning_yourself_does_not_notify(
        self, client: AsyncClient, db, project: Project, owner: User,
    ):
        await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(owner.id)]),
        )

        assert await self._notifications_for(db, owner.id) == []

    @pytest.mark.asyncio
    async def test_only_newly_added_assignees_are_notified_on_update(
        self, client: AsyncClient, db, project: Project, owner: User, member: User,
    ):
        create = await client.post(
            "/tasks", headers=auth_headers_for(owner),
            json=_payload(project.id, assigned_to=[str(member.id)]),
        )
        task_id = create.json()["id"]
        assert len(await self._notifications_for(db, member.id)) == 1

        # member stays assigned, owner is newly added — only owner should get a new notification
        await client.put(
            f"/tasks/{task_id}", headers=auth_headers_for(owner),
            json={"assigned_to": [str(member.id), str(owner.id)]},
        )

        assert len(await self._notifications_for(db, member.id)) == 1  # unchanged
        assert await self._notifications_for(db, owner.id) == []  # owner assigned themself — no notification
