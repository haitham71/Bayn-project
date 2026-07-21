"""
Unit tests for bayn.features.catalog.service

Assumes:
- Source module lives at bayn/features/catalog/service.py (adjust import
  below if your path differs).
- pytest-asyncio with asyncio_mode = auto; otherwise add @pytest.mark.asyncio
  per test instead of the module-level `pytestmark`.

These are pure unit tests: AsyncSession is fully mocked, so no real DB or
test Postgres instance is required.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bayn.common.exceptions import ConflictError, NotFoundError, ValidationError
from bayn.features.catalog.models import (
    Industry, Skill, Specialization, UserSkill, UserSpecialization,
)
from bayn.features.identity.models import Country, User
from bayn.integrations.storage.cloudflare import StorageError
from bayn.features.catalog import service


pytestmark = pytest.mark.asyncio



# Helpers


def make_execute_result(scalars_all=None, scalar_one=None):
    """Builds a fake `Result` object mimicking db.execute(...) return value."""
    result = MagicMock()
    if scalars_all is not None:
        result.scalars.return_value.all.return_value = scalars_all
    if scalar_one is not None:
        result.scalar_one.return_value = scalar_one
    return result


@pytest.fixture
def db():
    session = AsyncMock()
    # add() is synchronous on SQLAlchemy's AsyncSession, unlike everything else
    session.add = MagicMock()
    return session


@pytest.fixture(autouse=True)
def mock_t():
    """Stub i18n lookups so tests don't depend on real translation files."""
    with patch.object(service, "t", side_effect=lambda domain, key, locale: key):
        yield


def make_user(**overrides) -> MagicMock:
    defaults = dict(
        id=uuid.uuid4(),
        username="user",
        first_name_ar="اسم", last_name_ar="عائلة",
        first_name_en="Name", last_name_en="Family",
        specialization_id=None,
        bio=None,
        industry_id=None,
        years_of_experience=None,
        avatar_key=None,
    )
    defaults.update(overrides)
    return MagicMock(spec=User, **defaults)


def make_skill_rows_result(rows: list[tuple[uuid.UUID, str]]) -> MagicMock:
    """`get_all_users`'s skill query reads rows via `.all()` directly (not
    `.scalars().all()`, since each row is a (user_id, name) tuple)."""
    result = MagicMock()
    result.all.return_value = rows
    return result



# get_all_users


async def test_get_all_users_attaches_skills_and_avatar_url(db):
    alice = make_user(username="alice", specialization_id=uuid.uuid4(), avatar_key="avatars/alice.png")
    bob = make_user(username="bob")  # no skills, no avatar

    db.execute.side_effect = [
        make_execute_result(scalars_all=[alice, bob]),
        make_skill_rows_result([(alice.id, "Python"), (alice.id, "SQL")]),
    ]

    with patch.object(service.r2_client, "get_avatar_url", return_value="https://cdn.example/alice.png"):
        cards = await service.get_all_users(db)

    assert len(cards) == 2
    alice_card = next(c for c in cards if c.username == "alice")
    bob_card = next(c for c in cards if c.username == "bob")

    assert alice_card.skills == ["Python", "SQL"]
    assert alice_card.avatar_url == "https://cdn.example/alice.png"
    assert alice_card.specialization_id == alice.specialization_id

    assert bob_card.skills is None
    assert bob_card.avatar_url is None


async def test_get_all_users_empty_skips_skill_query(db):
    db.execute.return_value = make_execute_result(scalars_all=[])

    cards = await service.get_all_users(db)

    assert cards == []
    db.execute.assert_awaited_once()  # skill query is skipped when there are no users


async def test_get_all_users_avatar_storage_error_falls_back_to_none(db):
    user = make_user(avatar_key="avatars/broken.png")
    db.execute.side_effect = [
        make_execute_result(scalars_all=[user]),
        make_skill_rows_result([]),
    ]

    with patch.object(service.r2_client, "get_avatar_url", side_effect=StorageError("boom")):
        cards = await service.get_all_users(db)

    assert cards[0].avatar_url is None



# get_all_countries / get_all_industries


async def test_get_all_countries_returns_list(db):
    expected = [MagicMock(spec=Country), MagicMock(spec=Country)]
    db.execute.return_value = make_execute_result(scalars_all=expected)

    result = await service.get_all_countries(db)

    assert result == expected
    db.execute.assert_awaited_once()


async def test_get_all_industries_returns_list(db):
    expected = [MagicMock(spec=Industry)]
    db.execute.return_value = make_execute_result(scalars_all=expected)

    result = await service.get_all_industries(db)

    assert result == expected
    db.execute.assert_awaited_once()



# search_skills


async def test_search_skills_returns_matching_skills(db):
    expected = [MagicMock(spec=Skill), MagicMock(spec=Skill)]
    db.execute.return_value = make_execute_result(scalars_all=expected)

    result = await service.search_skills(db, "pyth")

    assert result == expected
    db.execute.assert_awaited_once()


async def test_search_skills_empty_query_still_calls_db(db):
    db.execute.return_value = make_execute_result(scalars_all=[])

    result = await service.search_skills(db, "")

    assert result == []
    db.execute.assert_awaited_once()



# add_skill_to_user


async def test_add_skill_to_user_success(db):
    user_id = uuid.uuid4()
    skill_id = uuid.uuid4()

    db.get.return_value = MagicMock(spec=Skill, id=skill_id)
    db.scalar.return_value = None  # no existing link for this (user, skill) pair

    created_link = MagicMock(spec=UserSkill)
    db.execute.side_effect = [
        make_execute_result(scalar_one=0),             # current skill count
        make_execute_result(scalar_one=created_link),  # reload with skill relationship
    ]

    result = await service.add_skill_to_user(db, user_id, skill_id)

    assert result is created_link
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


async def test_add_skill_to_user_limit_reached(db):
    user_id = uuid.uuid4()
    skill_id = uuid.uuid4()

    db.get.return_value = MagicMock(spec=Skill, id=skill_id)
    db.scalar.return_value = None
    db.execute.return_value = make_execute_result(scalar_one=7)  # already at the cap

    with pytest.raises(ValidationError):
        await service.add_skill_to_user(db, user_id, skill_id)

    db.add.assert_not_called()
    db.commit.assert_not_awaited()


async def test_add_skill_to_user_skill_not_found(db):
    # skill_id doesn't resolve via db.get() — the skill was never created
    # (or was hard-deleted), which the service must reject before touching
    # UserSkill at all.
    user_id = uuid.uuid4()
    skill_id = uuid.uuid4()
    db.get.return_value = None

    with pytest.raises(NotFoundError):
        await service.add_skill_to_user(db, user_id, skill_id)

    db.add.assert_not_called()
    db.commit.assert_not_awaited()


async def test_add_skill_to_user_already_added(db):
    user_id = uuid.uuid4()
    skill_id = uuid.uuid4()

    db.get.return_value = MagicMock(spec=Skill, id=skill_id)
    db.scalar.return_value = MagicMock(spec=UserSkill)  # link already exists

    with pytest.raises(ConflictError):
        await service.add_skill_to_user(db, user_id, skill_id)

    db.add.assert_not_called()
    db.commit.assert_not_awaited()



# remove_skill_from_user


async def test_remove_skill_from_user_success(db):
    user_id = uuid.uuid4()
    user_skill_id = uuid.uuid4()

    link = MagicMock(spec=UserSkill)
    db.scalar.return_value = link

    await service.remove_skill_from_user(db, user_id, user_skill_id)

    db.delete.assert_awaited_once_with(link)
    db.commit.assert_awaited_once()


async def test_remove_skill_from_user_not_found(db):
    db.scalar.return_value = None

    with pytest.raises(NotFoundError):
        await service.remove_skill_from_user(db, uuid.uuid4(), uuid.uuid4())

    db.delete.assert_not_awaited()
    db.commit.assert_not_awaited()


async def test_remove_skill_from_user_cannot_delete_other_users_link(db):
    # The service scopes its lookup by user_id, so a link owned by someone
    # else is indistinguishable from a missing one — this is what actually
    # prevents user A from deleting user B's UserSkill row by guessing its id.
    db.scalar.return_value = None

    with pytest.raises(NotFoundError):
        await service.remove_skill_from_user(db, uuid.uuid4(), uuid.uuid4())



# add_specialization_to_user


async def test_add_specialization_to_user_success(db):
    user_id = uuid.uuid4()
    specialization_id = uuid.uuid4()

    db.get.return_value = MagicMock(spec=Specialization, id=specialization_id)
    db.scalar.return_value = None

    created_link = MagicMock(spec=UserSpecialization)
    db.execute.return_value = make_execute_result(scalar_one=created_link)

    result = await service.add_specialization_to_user(db, user_id, specialization_id)

    assert result is created_link
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


async def test_add_specialization_to_user_not_found(db):
    db.get.return_value = None

    with pytest.raises(NotFoundError):
        await service.add_specialization_to_user(db, uuid.uuid4(), uuid.uuid4())

    db.add.assert_not_called()
    db.commit.assert_not_awaited()


async def test_add_specialization_to_user_already_added(db):
    specialization_id = uuid.uuid4()
    db.get.return_value = MagicMock(spec=Specialization, id=specialization_id)
    db.scalar.return_value = MagicMock(spec=UserSpecialization)

    with pytest.raises(ConflictError):
        await service.add_specialization_to_user(db, uuid.uuid4(), specialization_id)

    db.add.assert_not_called()
    db.commit.assert_not_awaited()