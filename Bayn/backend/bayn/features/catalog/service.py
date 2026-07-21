"""Catalog service — skills, specializations, industries, countries."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ConflictError, NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity import service as identity_service
from bayn.features.identity.models import City, Country
from bayn.features.catalog.models import (
    Industry, Skill, Specialization, UserSkill, UserSpecialization,
)
from bayn.features.catalog.schemas import UserCardResponse
from bayn.features.identity.models import User
from bayn.integrations.storage.cloudflare import StorageError, r2_client


async def get_all_users(db: AsyncSession, locale: str = DEFAULT_LOCALE) -> list[UserCardResponse]:
    result = await db.execute(
        select(User).where(User.deleted_at.is_(None))
    )
    users = result.scalars().all()

    # Each user's skill names, fetched in one query (mirrors projects.service.list_members).
    user_ids = [user.id for user in users]
    skill_map: dict[uuid.UUID, list[str]] = {}
    if user_ids:
        skill_rows = await db.execute(
            select(UserSkill.user_id, Skill.name)
            .join(Skill, UserSkill.skill_id == Skill.id)
            .where(UserSkill.user_id.in_(user_ids))
            .order_by(Skill.name)
        )
        for user_id, name in skill_rows.all():
            skill_map.setdefault(user_id, []).append(name)

    cards = []
    for user in users:
        avatar_url = None
        if user.avatar_key:
            try:
                avatar_url = r2_client.get_avatar_url(user.avatar_key)
            except StorageError:
                avatar_url = None
        cards.append(UserCardResponse(
            id=user.id,
            username=user.username,
            first_name_ar=user.first_name_ar,
            last_name_ar=user.last_name_ar,
            first_name_en=user.first_name_en,
            last_name_en=user.last_name_en,
            specialization_id=user.specialization_id,
            bio=user.bio,
            industry_id=user.industry_id,
            years_of_experience=user.years_of_experience,
            skills=skill_map.get(user.id),
            avatar_url=avatar_url,
        ))
    return cards

async def get_all_countries(db: AsyncSession) -> list[Country]:
    result = await db.execute(select(Country).order_by(Country.name_en))
    return result.scalars().all()


async def get_all_cities(db: AsyncSession, country_id: uuid.UUID | None = None) -> list[City]:
    query = select(City).order_by(City.name_en)
    if country_id is not None:
        query = query.where(City.country_id == country_id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_all_industries(db: AsyncSession) -> list[Industry]:
    result = await db.execute(select(Industry).order_by(Industry.name_en))
    return result.scalars().all()


async def get_all_specializations(db: AsyncSession) -> list[Specialization]:
    result = await db.execute(
        select(Specialization).where(Specialization.is_approved == True).order_by(Specialization.name_en)
    )
    return result.scalars().all()


async def search_skills(db: AsyncSession, query: str) -> list[Skill]:
    # is_approved filter hides unvetted user submissions. The cap is generous so
    # an empty query shows the whole curated list (the dropdown itself scrolls),
    # while still guarding against an unbounded result set as skills grow.
    result = await db.execute(
        select(Skill)
        .where(Skill.name.ilike(f"%{query}%"), Skill.is_approved == True)
        .order_by(Skill.name)
        .limit(100)
    )
    return result.scalars().all()


async def get_user_skills(db: AsyncSession, user_id: uuid.UUID) -> list[UserSkill]:
    # Returns the user's chosen skills (with each Skill loaded) so the profile
    # can show them and resolve names back to the row IDs needed for removal.
    result = await db.execute(
        select(UserSkill)
        .join(Skill, UserSkill.skill_id == Skill.id)
        .where(UserSkill.user_id == user_id)
        .options(selectinload(UserSkill.skill))
        .order_by(Skill.name)
    )
    return result.scalars().all()


async def add_skill_to_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    skill_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
) -> UserSkill:
    if not await db.get(Skill, skill_id):
        raise NotFoundError(t("catalog", "skill.not_found", locale))

    existing = await db.scalar(
        select(UserSkill).where(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
    )
    if existing:
        raise ConflictError(t("catalog", "skill.already_added", locale))

    skill_count = await identity_service._count_user_skills(db, user_id)
    if skill_count >= identity_service.MAX_SKILLS_PER_USER:
        raise ValidationError(t("catalog", "skill.limit_reached", locale))

    link = UserSkill(user_id=user_id, skill_id=skill_id)
    db.add(link)
    await db.commit()

    # reload with skill relationship for the nested response
    result = await db.execute(
        select(UserSkill).where(UserSkill.id == link.id).options(selectinload(UserSkill.skill))
    )
    return result.scalar_one()


async def remove_skill_from_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_skill_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
) -> None:
    # user_id filter prevents deleting another user's row by guessing its ID
    link = await db.scalar(
        select(UserSkill).where(UserSkill.id == user_skill_id, UserSkill.user_id == user_id)
    )
    if not link:
        raise NotFoundError(t("catalog", "skill.not_in_profile", locale))

    await db.delete(link)
    await db.commit()


async def get_user_specializations(db: AsyncSession, user_id: uuid.UUID) -> list[UserSpecialization]:
    # Mirrors get_user_skills: returns the user's specializations (each loaded)
    # so the profile can show them and resolve names back to removable row IDs.
    result = await db.execute(
        select(UserSpecialization)
        .join(Specialization, UserSpecialization.specialization_id == Specialization.id)
        .where(UserSpecialization.user_id == user_id)
        .options(selectinload(UserSpecialization.specialization))
        .order_by(Specialization.name_en)
    )
    return result.scalars().all()


async def remove_specialization_from_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_specialization_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
) -> None:
    # user_id filter prevents deleting another user's row by guessing its ID
    link = await db.scalar(
        select(UserSpecialization).where(
            UserSpecialization.id == user_specialization_id,
            UserSpecialization.user_id == user_id,
        )
    )
    if not link:
        raise NotFoundError(t("catalog", "specialization.not_in_profile", locale))

    await db.delete(link)
    await db.commit()


async def add_specialization_to_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    specialization_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
) -> UserSpecialization:
    if not await db.get(Specialization, specialization_id):
        raise NotFoundError(t("catalog", "specialization.not_found", locale))

    existing = await db.scalar(
        select(UserSpecialization).where(
            UserSpecialization.user_id == user_id,
            UserSpecialization.specialization_id == specialization_id,
        )
    )
    if existing:
        raise ConflictError(t("catalog", "specialization.already_added", locale))

    link = UserSpecialization(user_id=user_id, specialization_id=specialization_id)
    db.add(link)
    await db.commit()

    result = await db.execute(
        select(UserSpecialization)
        .where(UserSpecialization.id == link.id)
        .options(selectinload(UserSpecialization.specialization))
    )
    return result.scalar_one()
