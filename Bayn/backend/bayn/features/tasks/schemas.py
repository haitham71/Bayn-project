"""Pydantic schemas for the Tasks feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bayn.features.tasks.models import TaskPriority, TaskStatus


class TaskCreateRequest(BaseModel):
    project_id: uuid.UUID
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    due_date: datetime | None = None
    assigned_to: list[uuid.UUID] = Field(default_factory=list)


class TaskUpdateRequest(BaseModel):
    """Full edit — owner or a granted task editor only."""
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    assigned_to: list[uuid.UUID] | None = None


class TaskMemberUpdateRequest(BaseModel):
    """The limited edit any project member can make on their own: mark the
    task done/not done, and push the deadline later."""
    status: TaskStatus | None = None
    due_date: datetime | None = None


class TaskEditorGrantRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: datetime | None
    assigned_to: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime
