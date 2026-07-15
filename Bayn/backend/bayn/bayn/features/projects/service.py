"""Projects service — project CRUD and membership management."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import User
from bayn.features.projects.models import Project, ProjectMembership, ProjectMembershipRole
from bayn.features.projects.schemas import OwnerInfo, ProjectCreateRequest, ProjectUpdateRequest
from bayn.integrations.storage.cloudflare import StorageError, r2_client

# a user can hold membership (owner or member) in at most this many projects at once
MAX_MEMBERSHIPS_PER_USER = 2


async def _count_memberships(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(ProjectMembership).where(ProjectMembership.user_id == user_id)
    )
    return result.scalar_one()


def _to_owner_info(user: User) -> OwnerInfo:
    avatar_url = None
    if user.avatar_key:
        try:
            avatar_url = r2_client.get_avatar_url(user.avatar_key)
        except StorageError:
            avatar_url = None
    return OwnerInfo(
        id=user.id,
        name_en=f"{user.first_name_en} {user.last_name_en}".strip(),
        name_ar=f"{user.first_name_ar} {user.last_name_ar}".strip(),
        job_title=user.job_title,
        avatar_url=avatar_url,
    )


async def owners_map(db: AsyncSession, project_ids: list[uuid.UUID]) -> dict[uuid.UUID, OwnerInfo]:
    # Owner (the OWNER-role member) of each given project, in a single query.
    if not project_ids:
        return {}
    result = await db.execute(
        select(ProjectMembership.project_id, User)
        .join(User, User.id == ProjectMembership.user_id)
        .where(
            ProjectMembership.project_id.in_(project_ids),
            ProjectMembership.role == ProjectMembershipRole.OWNER,
        )
    )
    return {pid: _to_owner_info(user) for pid, user in result.all()}


async def create_project(
    db: AsyncSession,
    owner_user_id: uuid.UUID,
    payload: ProjectCreateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Project:
    if await _count_memberships(db, owner_user_id) >= MAX_MEMBERSHIPS_PER_USER:
        raise ConflictError(t("projects", "membership.limit_reached", locale))

    project = Project(**payload.model_dump())
    db.add(project)
    await db.flush()  # assigns project.id without ending the transaction

    db.add(ProjectMembership(user_id=owner_user_id, project_id=project.id, role=ProjectMembershipRole.OWNER))
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(db: AsyncSession, project_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise NotFoundError(t("projects", "project.not_found", locale))
    return project


async def list_projects(db: AsyncSession, include_hidden: bool = False) -> list[Project]:
    query = select(Project).order_by(Project.created_at.desc())
    if not include_hidden:
        query = query.where(Project.is_hidden == False)  # noqa: E712
    result = await db.execute(query)
    return result.scalars().all()


async def list_my_projects(
    db: AsyncSession, user_id: uuid.UUID
) -> list[tuple[Project, ProjectMembershipRole]]:
    # Every project the user belongs to (owner or member), with their role —
    # includes hidden ones they own. One join, no N+1.
    result = await db.execute(
        select(Project, ProjectMembership.role)
        .join(ProjectMembership, ProjectMembership.project_id == Project.id)
        .where(ProjectMembership.user_id == user_id)
        .order_by(Project.created_at.desc())
    )
    return list(result.all())


async def _require_owner(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str
) -> ProjectMembership:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if not membership or membership.role != ProjectMembershipRole.OWNER:
        raise ForbiddenError(t("projects", "project.owner_only", locale))
    return membership


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Project:
    project = await get_project(db, project_id, locale)
    await _require_owner(db, project_id, user_id, locale)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


async def list_members(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectMembership]:
    result = await db.execute(
        select(ProjectMembership).where(ProjectMembership.project_id == project_id)
    )
    return result.scalars().all()


async def join_project(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> ProjectMembership:
    await get_project(db, project_id, locale)  # 404s if the project doesn't exist

    existing = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if existing:
        raise ConflictError(t("projects", "membership.already_joined", locale))

    if await _count_memberships(db, user_id) >= MAX_MEMBERSHIPS_PER_USER:
        raise ConflictError(t("projects", "membership.limit_reached", locale))

    membership = ProjectMembership(user_id=user_id, project_id=project_id, role=ProjectMembershipRole.MEMBER)
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


async def leave_project(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if not membership:
        raise NotFoundError(t("projects", "membership.not_found", locale))

    if membership.role == ProjectMembershipRole.OWNER:
        raise ValidationError(t("projects", "membership.owner_cannot_leave", locale))

    await db.delete(membership)
    await db.commit()
