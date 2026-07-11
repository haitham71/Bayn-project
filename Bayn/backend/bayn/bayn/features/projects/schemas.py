"""Pydantic schemas for the Projects feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from bayn.features.projects.models import ProjectMembershipRole


class ProjectCreateRequest(BaseModel):
    title: str
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availibility: datetime | None = None
    is_hidden: bool = False


class ProjectUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availibility: datetime | None = None
    is_hidden: bool | None = None


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
    created_at: datetime
    updated_at: datetime


class ProjectMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    role: ProjectMembershipRole
    created_at: datetime
