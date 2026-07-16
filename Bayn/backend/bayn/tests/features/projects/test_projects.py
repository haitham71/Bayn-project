"""Projects feature tests: stage/team_members_needed are required at creation."""

import pytest
from httpx import AsyncClient


def _payload(**overrides) -> dict:
    payload = {"title": "Test Project", "stage": "planning", "team_members_needed": 3}
    payload.update(overrides)
    return payload


class TestCreateProject:

    @pytest.mark.asyncio
    async def test_create_project_success(self, client: AsyncClient, auth_headers: dict):
        response = await client.post("/projects", headers=auth_headers, json=_payload())

        assert response.status_code == 201
        data = response.json()
        assert data["stage"] == "planning"
        assert data["team_members_needed"] == 3

    @pytest.mark.asyncio
    async def test_create_project_missing_stage_rejected(self, client: AsyncClient, auth_headers: dict):
        payload = _payload()
        del payload["stage"]
        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_missing_team_size_rejected(self, client: AsyncClient, auth_headers: dict):
        payload = _payload()
        del payload["team_members_needed"]
        response = await client.post("/projects", headers=auth_headers, json=payload)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_team_size_out_of_range_rejected(self, client: AsyncClient, auth_headers: dict):
        response = await client.post("/projects", headers=auth_headers, json=_payload(team_members_needed=13))
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_invalid_stage_rejected(self, client: AsyncClient, auth_headers: dict):
        response = await client.post("/projects", headers=auth_headers, json=_payload(stage="not-a-real-stage"))
        assert response.status_code == 422
