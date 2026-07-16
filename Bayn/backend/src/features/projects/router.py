import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.identity.schemas import (
    ProfileUpdate,
    ProfileCardResponse,
    ProjectCreate,
    ProjectResponse,
    RatingCreate
)
from bayn.features.identity import service

router = APIRouter(prefix="/projects", tags=["projects Features"])

#function get all projects card (description + name)
#post project
#put -update- project
#delete project
#get project / project id (go inside the project page w details)
#get project by attrubute (will be --- industry, skills, specialization..)

# ── Project Endpoints ──────────────────────────────────────────────────────────

@router.patch("/me/card", response_model=ProfileCardResponse, summary="Update your profile developer card details")
async def update_my_card(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> ProfileCardResponse:  # what are those arrows doing here?!!
    await service.update_profile_card(db, current_user, payload)
    return await service.get_public_profile_card(db, (await service.get_or_create_profile(db, current_user.id)).id)


@router.get("/{profile_id}", response_model=ProfileCardResponse, summary="Get public portfolio details of a profile card")
async def get_profile_card(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> ProfileCardResponse:
    return await service.get_public_profile_card(db, profile_id)


# ── Project Management Endpoints ──────────────────────────────────────────────

@router.post("/me/projects", response_model=ProjectResponse, status_code=201, summary="Add a new project to your portfolio")
async def add_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectResponse:
    return await service.add_portfolio_project(db, current_user, payload)


@router.delete("/me/projects/{project_id}", status_code=204, summary="Remove a project from your portfolio")
async def remove_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await service.remove_portfolio_project(db, current_user, project_id)
    return None


# ── Rating Endpoints ──────────────────────────────────────────────────────────

@router.post("/{target_user_id}/rate", status_code=201, summary="Rate a peer user out of 5 stars")
async def rate_peer(
    target_user_id: uuid.UUID,
    payload: RatingCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await service.submit_peer_rating(db, current_user, target_user_id, payload)
    return {"message": "Rating submitted successfully"}

## AI completes this part out of my prompt:
## the hhtp endpoint: "expose funtions via router endpoints"
##from typing import List, Optional
##import uuid
##from fastapi import APIRouter, Depends, Query, status
##from sqlalchemy.ext.asyncio import AsyncSession

##from bayn.core.database import get_db
##from bayn.features.identity.dependencies import get_current_active_user
##from bayn.features.identity.models import User
##from bayn.features.identity.schemas import (
#    ProjectCreate, 
#   ProjectResponse, 
##    ProjectCardSummaryResponse # Imagine a minimal schema with just title & description
##)
##from bayn.features.identity import service

##router = APIRouter(prefix="/projects", tags=["Projects Feature"])

## check this part (and all parts) with Layla:

# 1. GET ALL PROJECTS CARDS
@router.get("/", response_model=List[ProjectResponse], summary="Get lightweight cards of all projects")
async def read_all_cards(db: AsyncSession = Depends(get_db)):
    return await service.get_all_project_cards(db)


# 2. GET PROJECTS BY ATTRIBUTES (FILTERING)
@router.get("/filter", response_model=List[ProjectResponse], summary="Filter projects by creator's industry, skills, or specialization")
async def get_projects_by_attributes(
    industry: Optional[str] = Query(None, description="Filter by industry UUID"), #should we make industry + specialization + skill as UUIDs?
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    skill: Optional[str] = Query(None, description="Filter by a specific skill"),
    db: AsyncSession = Depends(get_db)
):
    return await service.filter_projects(db, industry, specialization, skill)


# 3. GET PROJECT BY ID (DEEP DETAIL PAGE)
@router.get("/{project_id}", response_model=ProjectResponse, summary="Get full detailed project page including active calendar slots")
async def read_project_details(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await service.get_project_by_id(db, project_id)


# 4. POST PROJECT (With linked calendar_slot_ids)
@router.post("/", response_model=ProjectResponse, status_code=201, summary="Post a brand new project with recruitment meeting windows")
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    return await service.add_project(db, current_user, payload)


# 5. PUT (UPDATE) PROJECT
@router.put("/{project_id}", response_model=ProjectResponse, summary="Modify project scope details")
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate, # Reusing schema or a custom partial ProjectUpdate schema
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    clean_data = payload.model_dump(exclude_unset=True)
    return await service.update_project(db, current_user.id, project_id, clean_data)


# 6. DELETE PROJECT
@router.delete("/{project_id}", status_code=204, summary="Completely remove a project from public listings")
async def delete_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await service.remove_project(db, current_user, project_id)
    return None