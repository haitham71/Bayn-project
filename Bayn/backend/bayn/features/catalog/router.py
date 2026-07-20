"""Catalog (public) & Profile (authenticated) routers."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.core.database import get_db
from bayn.core.i18n import get_locale, localized_name
from bayn.features.catalog import service
from bayn.features.catalog.schemas import (
    AddSkillRequest, AddSpecializationRequest,
    CityResponse, CountryResponse, IndustryResponse, SkillResponse, SpecializationResponse,
    UserSkillResponse, UserSpecializationResponse,
)
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User


catalog_router = APIRouter(prefix="/catalog", tags=["Catalog"])


@catalog_router.get("/countries", response_model=list[CountryResponse], summary="List all countries")
async def list_countries(
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[CountryResponse]:
    countries = await service.get_all_countries(db)
    return [
        CountryResponse(
            id=c.id, name=localized_name(c.name_en, c.name_ar, locale), iso2=c.iso2, dial_code=c.dial_code
        )
        for c in countries
    ]


@catalog_router.get("/cities", response_model=list[CityResponse], summary="List cities (optionally filtered by country)")
async def list_cities(
    country_id: uuid.UUID | None = Query(None, description="Filter cities by country"),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[CityResponse]:
    cities = await service.get_all_cities(db, country_id)
    return [
        CityResponse(id=c.id, country_id=c.country_id, name=localized_name(c.name_en, c.name_ar, locale))
        for c in cities
    ]


@catalog_router.get("/industries", response_model=list[IndustryResponse], summary="List all industries")
async def list_industries(
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[IndustryResponse]:
    industries = await service.get_all_industries(db)
    return [
        IndustryResponse(
            id=i.id, name=localized_name(i.name_en, i.name_ar, locale), created_at=i.created_at
        )
        for i in industries
    ]


@catalog_router.get("/specializations", response_model=list[SpecializationResponse], summary="List all specializations")
async def list_specializations(
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[SpecializationResponse]:
    specializations = await service.get_all_specializations(db)
    return [
        SpecializationResponse(
            id=s.id, name=localized_name(s.name_en, s.name_ar, locale), is_approved=s.is_approved
        )
        for s in specializations
    ]


@catalog_router.get("/skills/search", response_model=list[SkillResponse], summary="Skill autocomplete")
async def search_skills(
    # Empty q is allowed: it returns the first slice of skills so the field can
    # show a browsable list on focus, before the user types anything.
    q: str = Query("", description="Search query"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillResponse]:
    return await service.search_skills(db, q)


profile_router = APIRouter(prefix="/profile", tags=["Profile"])


@profile_router.get("/skills", response_model=list[UserSkillResponse], summary="List current user's skills")
async def list_my_skills(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserSkillResponse]:
    return await service.get_user_skills(db, current_user.id)


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


@profile_router.get("/specializations", response_model=list[UserSpecializationResponse], summary="List current user's specializations")
async def list_my_specializations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> list[UserSpecializationResponse]:
    links = await service.get_user_specializations(db, current_user.id)
    return [
        UserSpecializationResponse(
            id=link.id,
            specialization_id=link.specialization_id,
            specialization=SpecializationResponse(
                id=link.specialization.id,
                name=localized_name(link.specialization.name_en, link.specialization.name_ar, locale),
                is_approved=link.specialization.is_approved,
            ),
            created_at=link.created_at,
        )
        for link in links
    ]


# user_specialization_id is the UserSpecialization row ID, not the Specialization ID
@profile_router.delete("/specializations/{user_specialization_id}", status_code=204, summary="Remove specialization from profile")
async def remove_specialization(
    user_specialization_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> None:
    await service.remove_specialization_from_user(db, current_user.id, user_specialization_id, locale)


@profile_router.post("/specializations", response_model=UserSpecializationResponse, status_code=201, summary="Add specialization to profile")
async def add_specialization(
    payload: AddSpecializationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    locale: str = Depends(get_locale),
) -> UserSpecializationResponse:
    link = await service.add_specialization_to_user(db, current_user.id, payload.specialization_id, locale)
    return UserSpecializationResponse(
        id=link.id,
        specialization_id=link.specialization_id,
        specialization=SpecializationResponse(
            id=link.specialization.id,
            name=localized_name(link.specialization.name_en, link.specialization.name_ar, locale),
            is_approved=link.specialization.is_approved,
        ),
        created_at=link.created_at,
    )
