"""Projects router."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.projects import service
from bayn.features.projects.schemas import (
    ProjectCreateRequest,
    ProjectMembershipResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)

projects_router = APIRouter(prefix="/projects", tags=["Projects"])


@projects_router.post("", response_model=ProjectResponse, status_code=201, summary="Create a project")
async def create_project(
    payload: ProjectCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    return await service.create_project(db, current_user.id, payload, locale)


@projects_router.get("", response_model=list[ProjectResponse], summary="List visible projects")
async def list_projects(
    include_hidden: bool = Query(False, description="Include hidden projects (owner/admin use)"),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    return await service.list_projects(db, include_hidden)


@projects_router.get("/{project_id}", response_model=ProjectResponse, summary="Get a project")
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    return await service.get_project(db, project_id, locale)


@projects_router.patch("/{project_id}", response_model=ProjectResponse, summary="Update a project (owner only)")
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectResponse:
    return await service.update_project(db, project_id, current_user.id, payload, locale)


@projects_router.get(
    "/{project_id}/members", response_model=list[ProjectMembershipResponse], summary="List project members"
)
async def list_members(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMembershipResponse]:
    return await service.list_members(db, project_id)


@projects_router.post(
    "/{project_id}/join", response_model=ProjectMembershipResponse, status_code=201, summary="Join a project"
)
async def join_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> ProjectMembershipResponse:
    return await service.join_project(db, project_id, current_user.id, locale)


@projects_router.delete("/{project_id}/leave", status_code=204, summary="Leave a project")
async def leave_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.leave_project(db, project_id, current_user.id, locale)
