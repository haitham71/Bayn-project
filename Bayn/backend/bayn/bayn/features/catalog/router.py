"""Catalog (public) & Profile (authenticated) routers."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.catalog import service
from bayn.features.catalog.schemas import (
    AddSkillRequest, AddSpecializationRequest,
    CountryResponse, IndustryResponse, SkillResponse,
    UserSkillResponse, UserSpecializationResponse,
)
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User


catalog_router = APIRouter(prefix="/catalog", tags=["Catalog"])


@catalog_router.get("/countries", response_model=list[CountryResponse], summary="List all countries")
async def list_countries(db: AsyncSession = Depends(get_db)) -> list[CountryResponse]:
    return await service.get_all_countries(db)


@catalog_router.get("/industries", response_model=list[IndustryResponse], summary="List all industries")
async def list_industries(db: AsyncSession = Depends(get_db)) -> list[IndustryResponse]:
    return await service.get_all_industries(db)


@catalog_router.get("/skills/search", response_model=list[SkillResponse], summary="Skill autocomplete")
async def search_skills(
    q: str = Query(..., min_length=1, description="Search query"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillResponse]:
    return await service.search_skills(db, q)


profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.post("/skills", response_model=UserSkillResponse, status_code=201, summary="Add skill to profile")
async def add_skill(
    payload: AddSkillRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserSkillResponse:
    return await service.add_skill_to_user(db, current_user.id, payload.skill_id, locale)


# user_skill_id is the UserSkill row ID, not the Skill ID
@profile_router.delete("/skills/{user_skill_id}", status_code=204, summary="Remove skill from profile")
async def remove_skill(
    user_skill_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.remove_skill_from_user(db, current_user.id, user_skill_id, locale)


@profile_router.post("/specializations", response_model=UserSpecializationResponse, status_code=201, summary="Add specialization to profile")
async def add_specialization(
    payload: AddSpecializationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserSpecializationResponse:
    return await service.add_specialization_to_user(db, current_user.id, payload.specialization_id, locale)
