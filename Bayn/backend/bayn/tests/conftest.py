"""Shared pytest fixtures.

Run tests:
    pytest tests/ -v
    pytest tests/features/identity/ -v
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bayn.common.exceptions import NotFoundError
from bayn.core.database import Base, get_db
from bayn.core.security import create_access_token, hash_password
from bayn.features.identity.models import Country, User, UserRole
from bayn.main import app


# in-memory SQLite avoids needing a running Postgres for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    # rollback after each test so tests don't leak state into each other
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_country(db: AsyncSession) -> Country:
    country = Country(
        name_en="Saudi Arabia",
        name_ar="المملكة العربية السعودية",
        iso2="SA",
        dial_code="+966",
    )
    db.add(country)
    await db.flush()
    await db.refresh(country)
    return country


@pytest_asyncio.fixture
async def test_user(db: AsyncSession, test_country: Country) -> User:
    user = User(
        first_name_ar="أسعد",
        last_name_ar="سعيد",
        first_name_en="Asaad",
        last_name_en="Saeed",
        email="test@example.com",
        username="asaad_test",
        password_hash=hash_password("TestPass123"),
        phone_country_id=test_country.id,
        phone_number=501234567,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user

@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
def mock_authentica():
    # patch the singleton so tests never hit the real Authentica API
    with patch("bayn.integrations.authentica.authentica_client") as mock:
        mock.send_email_otp = AsyncMock(return_value=None)
        mock.send_sms_otp = AsyncMock(return_value=None)
        mock.verify_email_otp = AsyncMock(return_value=True)
        mock.verify_sms_otp = AsyncMock(return_value=True)
        yield mock


@pytest_asyncio.fixture
def mock_r2():
    with patch("bayn.integrations.storage.cloudflare.r2_client") as mock:
        mock.upload_avatar.return_value = "avatars/test.png"
        mock.delete_avatar.return_value = None
        # real image on R2 — visible to anyone running the tests
        mock.get_avatar_url.return_value = "https://pub-e7461587069f419e8cadac646b04ce3b.r2.dev/avatars/test.png"
        yield mock
