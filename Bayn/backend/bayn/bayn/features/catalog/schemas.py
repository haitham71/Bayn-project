"""Pydantic schemas for the Catalog feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CountryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name_en: str
    name_ar: str
    iso2: str
    dial_code: str


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    is_approved: bool


class SpecializationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    is_approved: bool


class IndustryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
