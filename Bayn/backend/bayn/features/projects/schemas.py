"""Pydantic schemas for the Projects feature."""

import uuid
from datetime import datetime
from typing import Literal

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


class TeamSlotInput(BaseModel):
    """One team seat being requested — one specialization, or two if either
    would fill the seat."""
    specialization_id: uuid.UUID
    alternate_specialization_id: uuid.UUID | None = None


class TeamSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    specialization_id: uuid.UUID
    alternate_specialization_id: uuid.UUID | None = None


class ProjectCreateRequest(BaseModel):
    title: str
    description: str | None = None
    more_info: str | None = None
    industry_id: uuid.UUID | None = None
    availability: datetime | None = None
    is_hidden: bool = False
    stage: ProjectStage
    team_members_needed: int = Field(ge=1, le=12)
    # One entry per seat — length must equal team_members_needed.
    team_slots: list[TeamSlotInput] = Field(default_factory=list)
    slots: list[MeetingSlotInput] = Field(default_factory=list)
    skill_ids: list[uuid.UUID] = Field(default_factory=list)


class ProjectUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    more_info: str | None = None
    industry_id: uuid.UUID | None = None
    availability: datetime | None = None
    is_hidden: bool | None = None
    stage: ProjectStage | None = None
    team_members_needed: int | None = Field(default=None, ge=1, le=12)
    # When present, replaces the seat breakdown wholesale — length must equal
    # the resulting team_members_needed (the new value if given, else the current one).
    team_slots: list[TeamSlotInput] | None = None
    # When present, replaces the project's skill set wholesale (omit to leave as-is).
    skill_ids: list[uuid.UUID] | None = None


class OwnerInfo(BaseModel):
    """Public info about a project's owner, shown on the idea cards/details."""
    id: uuid.UUID
    name_en: str
    name_ar: str
    specialization_id: uuid.UUID | None = None
    avatar_url: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    more_info: str | None
    industry_id: uuid.UUID | None
    availability: datetime | None
    is_hidden: bool
    stage: ProjectStage
    team_members_needed: int
    team_slots: list[TeamSlotResponse] = Field(default_factory=list)
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


class ProjectMemberResponse(BaseModel):
    """A project member with the public info needed to show them in a team list."""
    user_id: uuid.UUID
    username: str
    name_en: str
    name_ar: str
    specialization_id: uuid.UUID | None = None
    specialization_en: str | None = None
    specialization_ar: str | None = None
    avatar_url: str | None = None
    role: ProjectMembershipRole


class MyProjectResponse(ProjectResponse):
    """A project the current user belongs to, plus their role in it."""
    role: ProjectMembershipRole


class ProjectFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    project_id: uuid.UUID
    uploaded_by: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    file_url: str
    created_at: datetime


class CalendarItemResponse(BaseModel):
    """A single entry on a project's calendar — either a task (placed by its
    deadline) or a meeting (placed by its start time)."""
    type: Literal["task", "meeting"]
    id: uuid.UUID
    title: str
    date: datetime
    end_date: datetime | None = None
    status: str | None = None
    priority: str | None = None
