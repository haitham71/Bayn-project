"""Catalog service — skills, specializations, industries, countries."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bayn.common.exceptions import ConflictError, NotFoundError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.identity.models import Country
from bayn.features.catalog.models import (
    Industry, Skill, Specialization, UserSkill, UserSpecialization,
)


async def get_all_countries(db: AsyncSession) -> list[Country]:
    result = await db.execute(select(Country).order_by(Country.name_en))
    return result.scalars().all()


async def get_all_industries(db: AsyncSession) -> list[Industry]:
    result = await db.execute(select(Industry).order_by(Industry.name))
    return result.scalars().all()


async def search_skills(db: AsyncSession, query: str) -> list[Skill]:
    # is_approved filter hides unvetted user submissions; limit feeds a dropdown
    result = await db.execute(
        select(Skill)
        .where(Skill.name.ilike(f"%{query}%"), Skill.is_approved == True)
        .order_by(Skill.name)
        .limit(20)
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
