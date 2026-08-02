"""Tasks router: create/update/delete project task board items, and manage
who besides the owner is allowed to fully edit them."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.tasks import service
from bayn.features.tasks.models import TaskStatus
from bayn.features.tasks.schemas import (
    TaskCreateRequest,
    TaskEditorGrantRequest,
    TaskMemberUpdateRequest,
    TaskResponse,
    TaskUpdateRequest,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "", response_model=TaskResponse, status_code=201,
    summary="Create a task on a project's task board (owner or a granted editor)",
)
async def create_task(
    payload: TaskCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TaskResponse:
    return await service.create_task(db, current_user.id, payload, locale)


@router.get("", response_model=list[TaskResponse], summary="List a project's tasks")
async def list_tasks(
    project_id: uuid.UUID = Query(...),
    status: TaskStatus | None = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[TaskResponse]:
    return await service.list_tasks(db, project_id, current_user.id, status, locale)


@router.put("/{task_id}", response_model=TaskResponse, summary="Fully update a task (owner or a granted editor)")
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TaskResponse:
    return await service.update_task(db, task_id, current_user.id, payload, locale)


@router.patch(
    "/{task_id}", response_model=TaskResponse,
    summary="Toggle a task's status and/or push its deadline later (any project member)",
)
async def update_task_as_member(
    task_id: uuid.UUID,
    payload: TaskMemberUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> TaskResponse:
    return await service.update_task_as_member(db, task_id, current_user.id, payload, locale)


@router.delete("/{task_id}", status_code=204, summary="Delete a task (owner or a granted editor)")
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.delete_task(db, task_id, current_user.id, locale)


@router.get(
    "/editors", response_model=list[uuid.UUID],
    summary="List the members granted full task-editing rights on a project",
)
async def list_task_editors(
    project_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[uuid.UUID]:
    return await service.list_task_editors(db, project_id, current_user.id, locale)


@router.post("/editors", status_code=204, summary="Grant a project member full task-editing rights (owner only)")
async def grant_task_editor(
    payload: TaskEditorGrantRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.grant_task_editor(db, current_user.id, payload.project_id, payload.user_id, locale)


@router.delete(
    "/editors/{project_id}/{user_id}", status_code=204,
    summary="Revoke a member's task-editing rights (owner only)",
)
async def revoke_task_editor(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.revoke_task_editor(db, current_user.id, project_id, user_id, locale)
