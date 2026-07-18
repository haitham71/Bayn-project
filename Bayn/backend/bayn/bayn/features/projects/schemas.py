"""Pydantic schemas for the Projects feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from bayn.features.catalog.schemas import SkillResponse
from bayn.features.projects.models import ProjectMembershipRole, ProjectStage, SlotStatus


class MeetingSlotInput(BaseModel):
    start_time: datetime
    end_time: datetime


class MeetingSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    project_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    status: SlotStatus


class SlotsReplaceRequest(BaseModel):
    slots: list[MeetingSlotInput] = Field(default_factory=list)


class ProjectCreateRequest(BaseModel):
    title: str
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availability: datetime | None = None
    is_hidden: bool = False
    stage: ProjectStage
    team_members_needed: int = Field(ge=1, le=12)
    slots: list[MeetingSlotInput] = Field(default_factory=list)
    skill_ids: list[uuid.UUID] = Field(default_factory=list)


class ProjectUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    more_info: str | None = None
    specialization_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None
    availability: datetime | None = None
    is_hidden: bool | None = None
    stage: ProjectStage | None = None
    team_members_needed: int | None = Field(default=None, ge=1, le=12)


class OwnerInfo(BaseModel):
    """Public info about a project's owner, shown on the idea cards/details."""
    id: uuid.UUID
    name_en: str
    name_ar: str
    job_title: str | None = None
    avatar_url: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    more_info: str | None
    specialization_id: uuid.UUID | None
    industry_id: uuid.UUID | None
    availability: datetime | None
    is_hidden: bool
    stage: ProjectStage
    team_members_needed: int
    created_at: datetime
    updated_at: datetime
    owner: OwnerInfo | None = None
    skills: list[SkillResponse] = Field(default_factory=list)


class ProjectMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    role: ProjectMembershipRole
    created_at: datetime


class MyProjectResponse(ProjectResponse):
    """A project the current user belongs to, plus their role in it."""
    role: ProjectMembershipRole
