"""Pydantic schemas for the project feature."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str
    more_info: str
    specialization_id: uuid.UUID
    industry_id: uuid.UUID
    availability: datetime
    is_hidden: bool
    updated_at: datetime
    created_at: datetime

class ProjectMembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID
    role: str
    created_at: datetime
    updated_at: datetime

# requets to come back to later

class ProjectCreateresponse(BaseModel):
    title: str
    description: str
    more_info: str
    specialization_id: uuid.UUID
    industry_id: uuid.UUID
    availability: datetime
    is_hidden: bool

class ProjectUpdateResponse(BaseModel):
    title: str
    description: str
    more_info: str
    specialization_id: uuid.UUID
    industry_id: uuid.UUID
    availability: datetime
    is_hidden: bool
    #images: Optional[List[str]] = None (should we add the option of adding images for updated -or even created- projects?)