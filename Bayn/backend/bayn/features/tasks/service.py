"""Tasks service — create/update/delete project task board items.

Two edit tiers: the owner (or a member the owner granted editor rights to)
can fully manage a project's tasks; any other member may only toggle a
task's status and push its deadline later.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ForbiddenError, NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import User
from bayn.features.notifications import service as notifications_service
from bayn.features.notifications.models import NotificationType
from bayn.features.projects.models import Project, ProjectMembership, ProjectMembershipRole
from bayn.features.tasks.models import Task, TaskAssignee, TaskEditor, TaskStatus
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
    task = await db.scalar(
        select(Task).where(Task.id == task_id).options(selectinload(Task.assignees))
    )
    if not task:
        raise NotFoundError(t("task", "not_found", locale))
    return task


async def _validate_assignees(db: AsyncSession, project_id: uuid.UUID, user_ids: list[uuid.UUID], locale: str) -> None:
    if not user_ids:
        return
    result = await db.execute(
        select(ProjectMembership.user_id).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id.in_(user_ids)
        )
    )
    members = set(result.scalars().all())
    if set(user_ids) - members:
        raise ValidationError(t("task", "invalid_assignee", locale))


def _notify_new_assignees(
    db: AsyncSession, actor: User, project: Project, task: Task, new_ids: set[uuid.UUID]
) -> None:
    if not new_ids:
        return
    data = {
        "actor_name_en": f"{actor.first_name_en} {actor.last_name_en}".strip(),
        "actor_name_ar": f"{actor.first_name_ar} {actor.last_name_ar}".strip(),
        "task_title": task.title,
        "project_id": str(project.id),
        "task_id": str(task.id),
    }
    for user_id in new_ids:
        if user_id == actor.id:
            continue  # you assigning yourself isn't news
        notifications_service.create_notification(db, user_id, NotificationType.task_assigned, data)


def _set_assignees(task: Task, user_ids: list[uuid.UUID]) -> None:
    # Diffed rather than clear-then-readd: an unchanged assignee must not be
    # deleted and reinserted in the same flush, since the DELETE and INSERT
    # for the same (task_id, user_id) can race against the unique constraint.
    # Goes through the relationship (not a raw bulk delete) so
    # cascade="delete-orphan" handles removals and the in-memory collection
    # stays correct — the session runs with expire_on_commit=False, so a
    # Core-level delete would leave `task.assignees` stale after commit.
    wanted = list(dict.fromkeys(user_ids))  # de-dupe, keep first-seen order
    wanted_ids = set(wanted)
    current_by_user = {assignee.user_id: assignee for assignee in task.assignees}

    for user_id, assignee in current_by_user.items():
        if user_id not in wanted_ids:
            task.assignees.remove(assignee)

    for user_id in wanted:
        if user_id not in current_by_user:
            task.assignees.append(TaskAssignee(user_id=user_id))


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

    await _validate_assignees(db, payload.project_id, payload.assigned_to, locale)

    data = payload.model_dump(exclude={"assigned_to"})
    task = Task(**data)
    _set_assignees(task, payload.assigned_to)
    db.add(task)

    actor = await db.get(User, user_id)
    _notify_new_assignees(db, actor, project, task, set(payload.assigned_to))

    await db.commit()
    return await _get_task(db, task.id, locale)


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
    assignees = data.pop("assigned_to", None)

    for field, value in data.items():
        setattr(task, field, value)

    if assignees is not None:
        await _validate_assignees(db, task.project_id, assignees, locale)
        previously_assigned = {a.user_id for a in task.assignees}
        _set_assignees(task, assignees)

        newly_assigned = set(assignees) - previously_assigned
        actor = await db.get(User, user_id)
        project = await db.get(Project, task.project_id)
        _notify_new_assignees(db, actor, project, task, newly_assigned)

    await db.commit()
    return await _get_task(db, task.id, locale)


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
    return await _get_task(db, task.id, locale)


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

    query = select(Task).where(Task.project_id == project_id).options(selectinload(Task.assignees))
    if status is not None:
        query = query.where(Task.status == status)
    result = await db.execute(query.order_by(Task.created_at.desc()))
    return result.scalars().all()


async def list_task_editors(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> list[uuid.UUID]:
    """Members the owner granted full task rights to. Readable by any member —
    the team list marks who can hand out tasks."""
    await _require_member(db, project_id, user_id, locale)

    rows = await db.execute(select(TaskEditor.user_id).where(TaskEditor.project_id == project_id))
    return list(rows.scalars().all())


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
