"""Projects service — project CRUD and membership management."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.catalog.models import Skill, Specialization, UserSpecialization
from bayn.features.identity.models import User
from bayn.features.projects.models import (
    Project,
    ProjectFile,
    ProjectMeetingSlot,
    ProjectMembership,
    ProjectMembershipRole,
    ProjectTeamSlot,
    SlotStatus,
)
from bayn.features.projects.schemas import (
    CalendarItemResponse,
    OwnerInfo,
    ProjectCreateRequest,
    ProjectFileResponse,
    ProjectMemberResponse,
    ProjectUpdateRequest,
    TeamSlotInput,
)
from bayn.integrations.storage.cloudflare import InvalidFileError, StorageError, r2_client

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
        specialization_id=user.specialization_id,
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


async def _validate_team_slot_specializations(
    db: AsyncSession, team_slots: list[TeamSlotInput], locale: str
) -> None:
    spec_ids = {slot.specialization_id for slot in team_slots}
    spec_ids |= {slot.alternate_specialization_id for slot in team_slots if slot.alternate_specialization_id}
    if not spec_ids:
        return
    result = await db.execute(select(Specialization.id).where(Specialization.id.in_(spec_ids)))
    existing = set(result.scalars().all())
    if spec_ids - existing:
        raise ValidationError(t("projects", "project.invalid_team_slot_specialization", locale))


def _build_team_slots(team_slots: list[TeamSlotInput]) -> list[ProjectTeamSlot]:
    return [
        ProjectTeamSlot(
            specialization_id=slot.specialization_id,
            alternate_specialization_id=slot.alternate_specialization_id,
        )
        for slot in team_slots
    ]


async def create_project(
    db: AsyncSession,
    owner_user_id: uuid.UUID,
    payload: ProjectCreateRequest,
    locale: str = DEFAULT_LOCALE,
) -> Project:
    if await _count_memberships(db, owner_user_id) >= MAX_MEMBERSHIPS_PER_USER:
        raise ConflictError(t("projects", "membership.limit_reached", locale))

    # One seat per team_slots entry, always — see ProjectTeamSlot's docstring.
    if len(payload.team_slots) != payload.team_members_needed:
        raise ValidationError(t("projects", "project.team_slots_count_mismatch", locale))
    await _validate_team_slot_specializations(db, payload.team_slots, locale)

    # Fetch chosen skills up front and attach them while the project is still a
    # transient object — assigning the collection after it's persisted would
    # trigger a (sync) lazy load and blow up under async. Unknown ids are dropped.
    skills: list[Skill] = []
    if payload.skill_ids:
        result = await db.execute(select(Skill).where(Skill.id.in_(payload.skill_ids)))
        skills = result.scalars().all()

    project = Project(**payload.model_dump(exclude={"slots", "skill_ids", "team_slots"}))
    project.skills = skills
    project.team_slots = _build_team_slots(payload.team_slots)
    db.add(project)
    await db.flush()  # assigns project.id without ending the transaction

    db.add(ProjectMembership(user_id=owner_user_id, project_id=project.id, role=ProjectMembershipRole.OWNER))
    for slot in payload.slots:
        db.add(ProjectMeetingSlot(
            project_id=project.id, start_time=slot.start_time, end_time=slot.end_time,
        ))

    await db.commit()
    # Re-fetch so the selectin skills relationship is loaded (not expired post-commit).
    return await get_project(db, project.id, locale)


async def list_available_slots(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectMeetingSlot]:
    # Only upcoming slots — past ones auto-expire (never returned).
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ProjectMeetingSlot)
        .where(
            ProjectMeetingSlot.project_id == project_id,
            ProjectMeetingSlot.status == SlotStatus.available,
            ProjectMeetingSlot.start_time > now,
        )
        .order_by(ProjectMeetingSlot.start_time)
    )
    return result.scalars().all()


async def replace_slots(db, project_id, user_id, slots, locale: str = DEFAULT_LOCALE):
    # Owner-only. Replaces the still-available slots (taken ones are kept, since
    # they belong to confirmed meetings) with the given set.
    from sqlalchemy import update
    from bayn.features.meetings.models import MeetingRequest  # local import avoids a cycle

    await _require_owner(db, project_id, user_id, locale)

    result = await db.execute(
        select(ProjectMeetingSlot).where(
            ProjectMeetingSlot.project_id == project_id,
            ProjectMeetingSlot.status == SlotStatus.available,
        )
    )
    existing = result.scalars().all()
    old_ids = [s.id for s in existing]
    if old_ids:
        # Detach any request that pointed at a slot we're removing — keeps the
        # request's proposed time; approving still adds a non-member.
        await db.execute(
            update(MeetingRequest).where(MeetingRequest.slot_id.in_(old_ids)).values(slot_id=None)
        )
        await db.flush()

    for slot in existing:
        await db.delete(slot)

    for s in slots:
        db.add(ProjectMeetingSlot(project_id=project_id, start_time=s.start_time, end_time=s.end_time))

    await db.commit()
    return await list_available_slots(db, project_id)


async def get_project(db: AsyncSession, project_id: uuid.UUID, locale: str = DEFAULT_LOCALE) -> Project:
    # A real SELECT with populate_existing refreshes any expired attributes on an
    # instance still in the session (e.g. updated_at / skills right after a write),
    # so the returned project is safe to serialize without a late lazy load.
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.skills), selectinload(Project.team_slots))
        .execution_options(populate_existing=True)
    )
    project = result.scalar_one_or_none()
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


async def _require_member(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str
) -> ProjectMembership:
    membership = await db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.project_id == project_id, ProjectMembership.user_id == user_id
        )
    )
    if not membership:
        raise ForbiddenError(t("projects", "membership.not_found", locale))
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

    data = payload.model_dump(exclude_unset=True)
    # skill_ids/team_slots aren't columns — replace the relationships separately.
    # project.skills/team_slots are already loaded (selectin, above), so
    # assigning them won't lazy-load.
    skill_ids = data.pop("skill_ids", None)
    team_slots_provided = "team_slots" in data
    data.pop("team_slots", None)

    for field, value in data.items():
        setattr(project, field, value)

    if team_slots_provided:
        if len(payload.team_slots) != project.team_members_needed:
            raise ValidationError(t("projects", "project.team_slots_count_mismatch", locale))
        await _validate_team_slot_specializations(db, payload.team_slots, locale)
        project.team_slots = _build_team_slots(payload.team_slots)
    elif "team_members_needed" in data and len(project.team_slots) != project.team_members_needed:
        # team_members_needed changed alone — the seat breakdown must be updated to match.
        raise ValidationError(t("projects", "project.team_slots_count_mismatch", locale))

    if skill_ids is not None:
        result = await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
        project.skills = result.scalars().all()

    await db.commit()
    # Re-fetch so the selectin skills relationship is loaded (not expired post-commit).
    return await get_project(db, project_id, locale)


async def list_members(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectMemberResponse]:
    # Members with the public info a team list needs (name, avatar, role).
    result = await db.execute(
        select(User, ProjectMembership.role)
        .join(ProjectMembership, ProjectMembership.user_id == User.id)
        .where(ProjectMembership.project_id == project_id)
        .order_by(ProjectMembership.created_at)
    )
    rows = result.all()

    # Each member's specialization (max one per profile), fetched in one query.
    user_ids = [user.id for user, _ in rows]
    spec_map: dict[uuid.UUID, tuple[str, str]] = {}
    if user_ids:
        spec_rows = await db.execute(
            select(UserSpecialization.user_id, Specialization.name_en, Specialization.name_ar)
            .join(Specialization, Specialization.id == UserSpecialization.specialization_id)
            .where(UserSpecialization.user_id.in_(user_ids))
        )
        for uid, name_en, name_ar in spec_rows.all():
            spec_map.setdefault(uid, (name_en, name_ar))

    members = []
    for user, role in rows:
        avatar_url = None
        if user.avatar_key:
            try:
                avatar_url = r2_client.get_avatar_url(user.avatar_key)
            except StorageError:
                avatar_url = None
        spec = spec_map.get(user.id)
        members.append(ProjectMemberResponse(
            user_id=user.id,
            name_en=f"{user.first_name_en} {user.last_name_en}".strip(),
            name_ar=f"{user.first_name_ar} {user.last_name_ar}".strip(),
            specialization_id=user.specialization_id,
            specialization_en=spec[0] if spec else None,
            specialization_ar=spec[1] if spec else None,
            avatar_url=avatar_url,
            role=role,
        ))
    return members


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


async def get_project_calendar(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> list[CalendarItemResponse]:
    """A project's tasks (placed by deadline) and meetings (placed by start
    time), merged into one chronologically-sorted calendar. Each of the two
    sub-fetches enforces its own project-membership/visibility rules."""
    from bayn.features.meetings import service as meetings_service  # local import avoids a cycle
    from bayn.features.tasks import service as tasks_service

    tasks = await tasks_service.list_tasks(db, project_id, user_id, status=None, locale=locale)
    meetings = await meetings_service.list_project_meetings(db, project_id, user_id, locale)

    items = [
        CalendarItemResponse(
            type="task",
            id=task.id,
            title=task.title,
            date=task.due_date,
            status=task.status.value,
            priority=task.priority.value,
        )
        for task in tasks
        if task.due_date is not None
    ]
    items += [
        CalendarItemResponse(
            type="meeting",
            id=meeting.id,
            title=meeting.title or "",
            date=meeting.start_time,
            end_date=meeting.end_time,
        )
        for meeting in meetings
    ]
    items.sort(key=lambda item: item.date)
    return items


# ── Project files ────────────────────────────────────────────────────────────

def _to_file_response(file: ProjectFile) -> ProjectFileResponse:
    return ProjectFileResponse(
        id=file.id,
        project_id=file.project_id,
        uploaded_by=file.uploaded_by,
        filename=file.filename,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        file_url=r2_client.get_project_file_url(file.file_key),
        created_at=file.created_at,
    )


async def upload_project_file(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    filename: str,
    file_bytes: bytes,
    content_type: str,
    locale: str = DEFAULT_LOCALE,
) -> ProjectFileResponse:
    await _require_member(db, project_id, user_id, locale)

    try:
        file_key = r2_client.upload_project_file(project_id, file_bytes, content_type)
    except InvalidFileError as e:
        raise ValidationError(e.message)
    except StorageError:
        raise ValidationError(t("projects", "file.upload_failed", locale))

    file = ProjectFile(
        project_id=project_id,
        uploaded_by=user_id,
        file_key=file_key,
        filename=filename,
        content_type=content_type,
        size_bytes=len(file_bytes),
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return _to_file_response(file)


async def list_project_files(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> list[ProjectFileResponse]:
    await _require_member(db, project_id, user_id, locale)

    result = await db.execute(
        select(ProjectFile)
        .where(ProjectFile.project_id == project_id)
        .order_by(ProjectFile.created_at.desc())
    )
    return [_to_file_response(f) for f in result.scalars().all()]


async def delete_project_file(
    db: AsyncSession, project_id: uuid.UUID, file_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> None:
    membership = await _require_member(db, project_id, user_id, locale)

    file = await db.scalar(
        select(ProjectFile).where(ProjectFile.id == file_id, ProjectFile.project_id == project_id)
    )
    if not file:
        raise NotFoundError(t("projects", "file.not_found", locale))

    # the uploader can always remove their own file; otherwise only the owner can
    if file.uploaded_by != user_id and membership.role != ProjectMembershipRole.OWNER:
        raise ForbiddenError(t("projects", "file.delete_forbidden", locale))

    try:
        r2_client.delete_project_file(file.file_key)
    except StorageError:
        pass  # the DB row is the source of truth for listing; an orphaned R2 object isn't user-visible

    await db.delete(file)
    await db.commit()
