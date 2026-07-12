"""Pydantic schemas for the Projects feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bayn.features.projects.models import ProjectMembershipRole, ProjectStage


class ProjectCreateRequest(BaseModel):
    title: str
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availibility: datetime | None = None
    is_hidden: bool = False
    stage: ProjectStage
    team_members_needed: int = Field(ge=1, le=12)


class ProjectUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availibility: datetime | None = None
    is_hidden: bool | None = None
    stage: ProjectStage | None = None
    team_members_needed: int | None = Field(default=None, ge=1, le=12)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    more_info: str | None
    specialization_id: uuid.UUID | None
    industry_id: uuid.UUID | None
    availibility: datetime | None
    is_hidden: bool
    stage: ProjectStage
    team_members_needed: int
    created_at: datetime
    updated_at: datetime


class ProjectMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    role: ProjectMembershipRole
    created_at: datetime
