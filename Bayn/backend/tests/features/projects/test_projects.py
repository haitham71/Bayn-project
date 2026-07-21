"""Projects feature tests: stage/team_members_needed are required at creation,
and the team_slots breakdown must always match team_members_needed."""

import pytest
from httpx import AsyncClient


def _payload(specialization_id, **overrides) -> dict:
    team_members_needed = overrides.get("team_members_needed", 3)
    payload = {
        "title": "Test Project",
        "stage": "planning",
        "team_members_needed": team_members_needed,
        "team_slots": [{"specialization_id": str(specialization_id)} for _ in range(team_members_needed)],
    }
    payload.update(overrides)
    return payload


class TestCreateProject:

    @pytest.mark.asyncio
    async def test_create_project_success(self, client: AsyncClient, auth_headers: dict, test_specialization):
        response = await client.post("/projects", headers=auth_headers, json=_payload(test_specialization.id))

        assert response.status_code == 201
        data = response.json()
        assert data["stage"] == "planning"
        assert data["team_members_needed"] == 3
        assert len(data["team_slots"]) == 3
        assert data["team_slots"][0]["specialization_id"] == str(test_specialization.id)

    @pytest.mark.asyncio
    async def test_create_project_missing_stage_rejected(self, client: AsyncClient, auth_headers: dict, test_specialization):
        payload = _payload(test_specialization.id)
        del payload["stage"]
        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_missing_team_size_rejected(self, client: AsyncClient, auth_headers: dict, test_specialization):
        payload = _payload(test_specialization.id)
        del payload["team_members_needed"]
        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_team_size_out_of_range_rejected(self, client: AsyncClient, auth_headers: dict, test_specialization):
        response = await client.post(
            "/projects", headers=auth_headers,
            json=_payload(test_specialization.id, team_members_needed=13),
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_invalid_stage_rejected(self, client: AsyncClient, auth_headers: dict, test_specialization):
        response = await client.post(
            "/projects", headers=auth_headers, json=_payload(test_specialization.id, stage="not-a-real-stage")
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_team_slots_count_must_match_team_members_needed(
        self, client: AsyncClient, auth_headers: dict, test_specialization
    ):
        payload = _payload(test_specialization.id, team_members_needed=3)
        payload["team_slots"] = payload["team_slots"][:2]  # only 2 slots for 3 needed seats

        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_team_slot_with_unknown_specialization_rejected(
        self, client: AsyncClient, auth_headers: dict, test_specialization
    ):
        import uuid
        payload = _payload(test_specialization.id, team_members_needed=1)
        payload["team_slots"] = [{"specialization_id": str(uuid.uuid4())}]

        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_team_slot_accepts_an_alternate_specialization(
        self, client: AsyncClient, auth_headers: dict, test_specialization, db
    ):
        from bayn.features.catalog.models import Specialization
        alternate = Specialization(name_en="Full-stack", name_ar="فل ستاك")
        db.add(alternate)
        await db.flush()

        payload = _payload(test_specialization.id, team_members_needed=1)
        payload["team_slots"] = [{
            "specialization_id": str(test_specialization.id),
            "alternate_specialization_id": str(alternate.id),
        }]

        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 201
        assert response.json()["team_slots"][0]["alternate_specialization_id"] == str(alternate.id)


class TestUpdateProject:

    @pytest.mark.asyncio
    async def test_owner_can_replace_team_slots(self, client: AsyncClient, auth_headers: dict, test_specialization, db):
        create = await client.post("/projects", headers=auth_headers, json=_payload(test_specialization.id))
        project_id = create.json()["id"]

        from bayn.features.catalog.models import Specialization
        new_spec = Specialization(name_en="Design", name_ar="تصميم")
        db.add(new_spec)
        await db.flush()

        response = await client.put(
            f"/projects/{project_id}", headers=auth_headers,
            json={"team_slots": [{"specialization_id": str(new_spec.id)}] * 3},
        )
        assert response.status_code == 200
        assert all(s["specialization_id"] == str(new_spec.id) for s in response.json()["team_slots"])

    @pytest.mark.asyncio
    async def test_changing_team_members_needed_alone_is_rejected_on_mismatch(
        self, client: AsyncClient, auth_headers: dict, test_specialization
    ):
        create = await client.post("/projects", headers=auth_headers, json=_payload(test_specialization.id))
        project_id = create.json()["id"]

        response = await client.put(
            f"/projects/{project_id}", headers=auth_headers, json={"team_members_needed": 5}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_changing_team_members_needed_with_matching_slots_succeeds(
        self, client: AsyncClient, auth_headers: dict, test_specialization
    ):
        create = await client.post("/projects", headers=auth_headers, json=_payload(test_specialization.id))
        project_id = create.json()["id"]

        response = await client.put(
            f"/projects/{project_id}", headers=auth_headers,
            json={
                "team_members_needed": 5,
                "team_slots": [{"specialization_id": str(test_specialization.id)}] * 5,
            },
        )
        assert response.status_code == 200
        assert response.json()["team_members_needed"] == 5
