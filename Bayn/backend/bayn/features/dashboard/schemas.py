"""Pydantic schemas for the project Dashboard feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from bayn.features.projects.models import ProjectMembershipRole
from bayn.features.tasks.models import TaskPriority, TaskStatus


class TeamMemberResponse(BaseModel):
    id: uuid.UUID
    name_en: str
    name_ar: str
    role: ProjectMembershipRole


class DashboardTaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: TaskStatus
    priority: TaskPriority
    due_date: datetime | None
    assigned_to: list[TeamMemberResponse]
    time_remaining_seconds: int | None = None


class ProjectDashboardResponse(BaseModel):
    team_members: list[TeamMemberResponse]
    total_tasks: int
    tasks_due_this_week: int
    # binary split: done vs everything else (todo + in_progress)
    completed_percentage: float
    incomplete_percentage: float
    tasks: list[DashboardTaskResponse]
