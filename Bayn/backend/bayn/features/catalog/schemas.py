"""Pydantic schemas for the Catalog feature."""

import uuid
from datetime import datetime
from typing import Optional
from bayn.features.identity.models import ExperienceRange

from pydantic import BaseModel, ConfigDict


class CountryResponse(BaseModel):
    id: uuid.UUID
    name: str
    iso2: str
    dial_code: str


class CityResponse(BaseModel):
    id: uuid.UUID
    country_id: uuid.UUID
    name: str


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    #is_approved: bool


class SpecializationResponse(BaseModel):
    id: uuid.UUID
    name: str
    #is_approved: bool


class IndustryResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime


class AddSkillRequest(BaseModel):
    skill_id: uuid.UUID


class AddSpecializationRequest(BaseModel):
    specialization_id: uuid.UUID


class UserSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    skill_id: uuid.UUID
    skill: SkillResponse
    created_at: datetime


class UserSpecializationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    specialization_id: uuid.UUID
    specialization: SpecializationResponse
    created_at: datetime


class UserCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    first_name_ar: str
    last_name_ar: str
    first_name_en: str
    last_name_en: str
    specialization_id: Optional[uuid.UUID] = None
    bio: Optional[str] = None
    industry_id: Optional[uuid.UUID] = None
    years_of_experience: Optional[ExperienceRange] = None
    skills: Optional[list[str]] = None
    avatar_url: Optional[str] = None
