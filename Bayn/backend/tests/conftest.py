"""Shared pytest fixtures.

Run tests:
    pytest tests/ -v
    pytest tests/features/identity/ -v
"""

import asyncio
from collections.abc import AsyncGenerator
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from bayn.common.exceptions import NotFoundError
from bayn.core.database import Base, get_db
from bayn.core.security import create_access_token, hash_password
from bayn.features.identity.models import City, Country, User
from bayn.main import app


# in-memory SQLite avoids needing a running Postgres for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)
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
    async with test_engine.connect() as conn:
        # Outer transaction is never committed, so the final rollback undoes
        # everything below it — including any commit() the app code itself
        # calls inside signup/update/delete endpoints via the client fixture.
        outer_trans = await conn.begin()

        async with AsyncSession(bind=conn, expire_on_commit=False) as session:
            nested = await conn.begin_nested()

            # Every commit() (ours or the app's) closes the current SAVEPOINT.
            # This listener reopens one immediately, so there's always an
            # active savepoint for the session to write into.
            @event.listens_for(session.sync_session, "after_transaction_end")
            def restart_savepoint(sess, transaction):
                nonlocal nested
                if not nested.is_active:
                    nested = conn.sync_connection.begin_nested()

            yield session

        await outer_trans.rollback()


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
async def test_city(db: AsyncSession, test_country: Country) -> City:
    city = City(
        country_id=test_country.id,
        name_en="Riyadh",
        name_ar="الرياض",
    )
    db.add(city)
    await db.flush()
    await db.refresh(city)
    return city

@pytest_asyncio.fixture
async def test_user(db: AsyncSession, test_country: Country) -> User:
    user = User(
        first_name_ar="أسعد",
        last_name_ar="سعيد",
        first_name_en="Asaad",
        last_name_en="Saeed",
        birth_date=date(2000, 1, 1),
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
    with patch("bayn.features.identity.service.authentica_client") as mock:
        mock.send_email_otp = AsyncMock(return_value=None)
        mock.send_sms_otp = AsyncMock(return_value=None)
        mock.verify_email_otp = AsyncMock(return_value=True)
        mock.verify_sms_otp = AsyncMock(return_value=True)
        yield mock


@pytest_asyncio.fixture
def mock_email():
    # patch the singleton so tests never hit a real SMTP server
    with patch("bayn.features.identity.password_service.email_client") as mock:
        mock.send_email = AsyncMock(return_value=None)
        yield mock


@pytest_asyncio.fixture
def mock_r2():
    with patch("bayn.integrations.storage.cloudflare.r2_client") as mock:
        mock.upload_avatar.return_value = "avatars/test.png"
        mock.delete_avatar.return_value = None
        # real image on R2 — visible to anyone running the tests
        mock.get_avatar_url.return_value = "https://pub-e7461587069f419e8cadac646b04ce3b.r2.dev/avatars/test.png"
        yield mock


@pytest_asyncio.fixture
def mock_daily():
    # patch the singleton so tests never hit the real Daily.co API
    with patch("bayn.features.meetings.service.daily_client") as mock:
        mock.create_room = AsyncMock(return_value={"url": "https://bayn.daily.co/test-room"})
        mock.create_meeting_token = AsyncMock(return_value="test-token")
        yield mock


@pytest_asyncio.fixture
def mock_calcom():
    # patch the singleton so tests never hit the real Cal.com API (and never
    # create a real booking on the live shared calendar)
    with patch("bayn.features.meetings.service.calcom_client") as mock:
        mock.create_booking = AsyncMock(return_value={"data": {"uid": "test-calcom-booking"}})
        yield mock


@pytest_asyncio.fixture
def mock_nda():
    """Patch Signature-System so tests never create real contracts or email
    anyone a signing link.

    Starts out unsigned, which is the state accepting a request lands in. Use
    `sign()` to move it to fully signed, the way both parties signing would.
    """
    with patch("bayn.features.contracts.service.nda_service_client") as mock:
        state = {"id": "test-contract-id", "status": "pending_party_one"}
        mock.create_contract = AsyncMock(return_value=state)
        mock.get_contract = AsyncMock(side_effect=lambda _id: dict(state))

        def sign(status: str = "signed") -> None:
            state["status"] = status

        mock.sign = sign
        yield mock
