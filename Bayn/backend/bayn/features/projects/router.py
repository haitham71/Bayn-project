"""Projects router: create/list/update projects, membership, and meeting slots."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.projects import service
from bayn.features.projects.schemas import (
    CalendarItemResponse,
    MeetingSlotResponse,
    MyProjectResponse,
    ProjectCreateRequest,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdateRequest,
    SlotsReplaceRequest,
)

projects_router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_response(project, owner=None) -> ProjectResponse:
    resp = ProjectResponse.model_validate(project)
    resp.owner = owner
    return resp


@projects_router.post("", response_model=ProjectResponse, status_code=201, summary="Create a new project")
async def create_project(
    payload: ProjectCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    project = await service.create_project(db, current_user.id, payload, locale)
    owners = await service.owners_map(db, [project.id])
    return _to_response(project, owners.get(project.id))


@projects_router.get("", response_model=list[ProjectResponse], summary="List public projects")
async def list_projects(
    include_hidden: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    projects = await service.list_projects(db, include_hidden)
    owners = await service.owners_map(db, [p.id for p in projects])
    return [_to_response(p, owners.get(p.id)) for p in projects]


@projects_router.get("/me", response_model=list[MyProjectResponse], summary="List my projects")
async def list_my_projects(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[MyProjectResponse]:
    rows = await service.list_my_projects(db, current_user.id)
    owners = await service.owners_map(db, [p.id for p, _ in rows])
    result = []
    for project, role in rows:
        # role isn't a column on Project — set it as a transient attribute so
        # from_attributes validation can pick it up (it's required on the schema).
        project.role = role
        resp = MyProjectResponse.model_validate(project)
        resp.owner = owners.get(project.id)
        result.append(resp)
    return result


@projects_router.get("/{project_id}", response_model=ProjectResponse, summary="Get a project")
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    project = await service.get_project(db, project_id, locale)
    owners = await service.owners_map(db, [project.id])
    return _to_response(project, owners.get(project.id))


@projects_router.put("/{project_id}", response_model=ProjectResponse, summary="Update a project (owner only)")
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    project = await service.update_project(db, project_id, current_user.id, payload, locale)
    owners = await service.owners_map(db, [project.id])
    return _to_response(project, owners.get(project.id))


@projects_router.get(
    "/{project_id}/members", response_model=list[ProjectMemberResponse], summary="List a project's members"
)
async def list_members(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMemberResponse]:
    return await service.list_members(db, project_id)


@projects_router.delete("/{project_id}/leave", status_code=204, summary="Leave a project")
async def leave_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.leave_project(db, project_id, current_user.id, locale)


@projects_router.get(
    "/{project_id}/slots", response_model=list[MeetingSlotResponse], summary="List a project's available meeting slots"
)
async def list_available_slots(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[MeetingSlotResponse]:
    return await service.list_available_slots(db, project_id)


@projects_router.put(
    "/{project_id}/slots",
    response_model=list[MeetingSlotResponse],
    summary="Replace a project's available meeting slots (owner only)",
)
async def replace_slots(
    project_id: uuid.UUID,
    payload: SlotsReplaceRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[MeetingSlotResponse]:
    return await service.replace_slots(db, project_id, current_user.id, payload.slots, locale)


@projects_router.get(
    "/{project_id}/calendar",
    response_model=list[CalendarItemResponse],
    summary="A project's tasks and meetings, merged into one calendar",
)
async def get_project_calendar(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[CalendarItemResponse]:
    return await service.get_project_calendar(db, project_id, current_user.id, locale)
