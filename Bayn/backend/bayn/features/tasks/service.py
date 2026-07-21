"""Tasks service — create/update/delete project task board items.

Two edit tiers: the owner (or a member the owner granted editor rights to)
can fully manage a project's tasks; any other member may only toggle a
task's status and push its deadline later.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ForbiddenError, NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.projects.models import Project, ProjectMembership, ProjectMembershipRole
from bayn.features.tasks.models import Task, TaskEditor, TaskStatus
from bayn.features.tasks.schemas import TaskCreateRequest, TaskMemberUpdateRequest, TaskUpdateRequest


def _ensure_aware(dt: datetime) -> datetime:
    # SQLite (tests) drops tzinfo on round-trip; Postgres preserves it
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def _require_member(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str) -> ProjectMembership:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if not membership:
        raise ForbiddenError(t("task", "not_a_member", locale))
    return membership


async def _require_owner(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str) -> None:
    membership = await _require_member(db, project_id, user_id, locale)
    if membership.role != ProjectMembershipRole.OWNER:
        raise ForbiddenError(t("task", "owner_only", locale))


async def _require_editor(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str) -> None:
    membership = await _require_member(db, project_id, user_id, locale)
    if membership.role == ProjectMembershipRole.OWNER:
        return
    is_editor = await db.scalar(
        select(TaskEditor).where(TaskEditor.project_id == project_id, TaskEditor.user_id == user_id)
    )
    if not is_editor:
        raise ForbiddenError(t("task", "editor_only", locale))


async def _get_task(db: AsyncSession, task_id: uuid.UUID, locale: str) -> Task:
    task = await db.get(Task, task_id)
    if not task:
        raise NotFoundError(t("task", "not_found", locale))
    return task


async def _validate_assignee(db: AsyncSession, project_id: uuid.UUID, assigned_to: uuid.UUID, locale: str) -> None:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == assigned_to
        )
    )
    if not membership:
        raise ValidationError(t("task", "invalid_assignee", locale))


async def create_task(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload: TaskCreateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Task:
    project = await db.get(Project, payload.project_id)
    if not project:
        raise NotFoundError(t("projects", "project.not_found", locale))
    await _require_editor(db, payload.project_id, user_id, locale)

    if payload.assigned_to is not None:
        await _validate_assignee(db, payload.project_id, payload.assigned_to, locale)

    task = Task(**payload.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TaskUpdateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Task:
    task = await _get_task(db, task_id, locale)
    await _require_editor(db, task.project_id, user_id, locale)

    data = payload.model_dump(exclude_unset=True)

    if data.get("assigned_to") is not None:
        await _validate_assignee(db, task.project_id, data["assigned_to"], locale)

    for field, value in data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


async def update_task_as_member(
    db: AsyncSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TaskMemberUpdateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Task:
    """Any project member may toggle a task's status and push its deadline
    later — nothing else, and the deadline can only move forward."""
    task = await _get_task(db, task_id, locale)
    await _require_member(db, task.project_id, user_id, locale)

    data = payload.model_dump(exclude_unset=True)

    if "due_date" in data and data["due_date"] is not None:
        current = task.due_date
        if current is not None and _ensure_aware(data["due_date"]) <= _ensure_aware(current):
            raise ValidationError(t("task", "deadline_must_extend", locale))

    for field, value in data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(
    db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    task = await _get_task(db, task_id, locale)
    await _require_editor(db, task.project_id, user_id, locale)

    await db.delete(task)
    await db.commit()


async def list_tasks(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    status: TaskStatus | None = None,
    locale: str = DEFAULT_LOCALE,
) -> list[Task]:
    await _require_member(db, project_id, user_id, locale)

    query = select(Task).where(Task.project_id == project_id)
    if status is not None:
        query = query.where(Task.status == status)
    result = await db.execute(query.order_by(Task.created_at.desc()))
    return result.scalars().all()


async def grant_task_editor(
    db: AsyncSession, owner_id: uuid.UUID, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    await _require_owner(db, project_id, owner_id, locale)
    await _require_member(db, project_id, user_id, locale)

    existing = await db.scalar(
        select(TaskEditor).where(TaskEditor.project_id == project_id, TaskEditor.user_id == user_id)
    )
    if existing:
        return

    db.add(TaskEditor(project_id=project_id, user_id=user_id))
    await db.commit()


async def revoke_task_editor(
    db: AsyncSession, owner_id: uuid.UUID, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    await _require_owner(db, project_id, owner_id, locale)

    editor = await db.scalar(
        select(TaskEditor).where(TaskEditor.project_id == project_id, TaskEditor.user_id == user_id)
    )
    if editor:
        await db.delete(editor)
        await db.commit()
