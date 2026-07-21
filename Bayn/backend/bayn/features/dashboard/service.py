"""Dashboard service — team roster and task stats for a project's dashboard."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ForbiddenError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.dashboard.schemas import DashboardTaskResponse, ProjectDashboardResponse, TeamMemberResponse
from bayn.features.identity.models import User
from bayn.features.projects import service as projects_service
from bayn.features.projects.models import ProjectMembership
from bayn.features.tasks import service as tasks_service
from bayn.features.tasks.models import TaskStatus


def _ensure_aware(dt: datetime) -> datetime:
    # SQLite (tests) drops tzinfo on round-trip; Postgres preserves it
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _week_bounds_utc(now: datetime) -> tuple[datetime, datetime]:
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=7)




async def get_project_dashboard(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID, locale: str = DEFAULT_LOCALE
) -> ProjectDashboardResponse:
    """Team roster plus task stats for a project's dashboard: total/this-week
    counts, a done-vs-rest completion split, and every task annotated with
    time left until its deadline."""
    await projects_service.get_project(db, project_id, locale)  # 404 if the project doesn't exist

    membership_rows = await db.execute(
        select(ProjectMembership, User)
        .join(User, User.id == ProjectMembership.user_id)
        .where(ProjectMembership.project_id == project_id)
    )
    rows = membership_rows.all()
    if not any(u.id == user_id for _, u in rows):
        raise ForbiddenError(t("projects", "membership.not_found", locale))

    team_members = [
        TeamMemberResponse(
            id=u.id,
            name_en=f"{u.first_name_en} {u.last_name_en}".strip(),
            name_ar=f"{u.first_name_ar} {u.last_name_ar}".strip(),
            role=m.role,
        )
        for m, u in rows
    ]

    tasks = await tasks_service.list_tasks(db, project_id, user_id, status=None, locale=locale)
    meetings = await tasks_service.list_meetings(db, project_id, user_id, status=None, locale=locale)

    members_by_id = {member.id: member for member in team_members}

    now = datetime.now(timezone.utc)
    week_start, week_end = _week_bounds_utc(now)

    total_tasks = len(tasks)
    done_count = sum(1 for task in tasks if task.status == TaskStatus.done)
    completed_pct = round((done_count / total_tasks) * 100, 1) if total_tasks else 0.0
    incomplete_pct = round(100 - completed_pct, 1) if total_tasks else 0.0
    tasks_this_week = sum(
        1 for task in tasks
        if task.due_date is not None and week_start <= _ensure_aware(task.due_date) < week_end
    )

    task_items = [
        DashboardTaskResponse(
            id=task.id,
            title=task.title,
            status=task.status,
            priority=task.priority,
            due_date=task.due_date,
            assigned_to=[
                members_by_id[user_id] for user_id in task.assigned_to if user_id in members_by_id
            ],
            time_remaining_seconds=(
                int((_ensure_aware(task.due_date) - now).total_seconds()) if task.due_date else None
            ),
        )
        for task in tasks
    ]

    total_meetings = len(meetings)
    meetings_this_week = sum(
        1 for meeting in meetings
        if meeting.due_date is not None and week_start <= _ensure_aware(meeting.due_date) < week_end
    )

    return ProjectDashboardResponse(
        team_members=team_members,
        total_tasks=total_tasks,
        total_meetings=total_meetings,
        meetings_due_this_week=meetings_this_week,
        tasks_due_this_week=tasks_this_week,
        completed_percentage=completed_pct,
        incomplete_percentage=incomplete_pct,
        tasks=task_items,
    )
