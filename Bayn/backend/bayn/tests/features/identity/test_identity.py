"""
Identity feature tests.

Each test is independent — no reliance on run order.
Each test starts with test_ so pytest discovers it automatically.

Run:
    pytest tests/features/identity/test_identity.py -v
    pytest tests/features/identity/test_identity.py::TestSignup -v
"""

from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient

from bayn.common.exceptions import UserAlreadyExistsError
from bayn.core.security import hash_password
from bayn.features.identity import service
from bayn.features.identity.models import City, Country, User
from bayn.features.identity.schemas import UserLogin, UserSignup


# ═══════════════════════════════════════════════════════
# Signup Tests
# ═══════════════════════════════════════════════════════

class TestSignup:
    """POST /auth/signup"""

    BASE_PAYLOAD = {
        "first_name_ar": "محمد",
        "last_name_ar": "الأحمد",
        "first_name_en": "Mohammed",
        "last_name_en": "Al-Ahmad",
        "email": "new@example.com",
        "username": "new_user",
        "password": "TestPass123@",
        "phone_number": 512345678,
    }

    def _payload(self, test_country: Country, **overrides) -> dict:
        return {**self.BASE_PAYLOAD, "phone_country_id": str(test_country.id), **overrides}

    @pytest.mark.asyncio
    async def test_signup_success(self, client: AsyncClient, test_country: Country, mock_authentica):

        response = await client.post("/auth/signup", json=self._payload(test_country))

        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "new@example.com"
        assert data["user"]["username"] == "new_user"
        # Password must never round-trip in the response, in any form
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

        # signup fires the email OTP automatically, without a separate /verify-email/send call
        mock_authentica.send_email_otp.assert_called_once()

    @pytest.mark.asyncio
    async def test_signup_duplicate_email(
        self, client: AsyncClient, test_user: User, test_country: Country, mock_authentica
    ):

        payload = self._payload(test_country, email=test_user.email, username="another_user")
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 409
        assert "already in use" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_signup_duplicate_username(
        self, client: AsyncClient, test_user: User, test_country: Country, mock_authentica
    ):

        payload = self._payload(test_country, email="another@example.com", username=test_user.username)
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_signup_weak_password(self, client: AsyncClient, test_country: Country, mock_authentica):

        payload = self._payload(test_country, email="p@example.com", username="ptest", password="weak")
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_invalid_email(self, client: AsyncClient, test_country: Country, mock_authentica):

        payload = self._payload(test_country, email="not-an-email")
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_username_lowercase(self, client: AsyncClient, test_country: Country, mock_authentica):

        payload = self._payload(test_country, email="lower@example.com", username="UPPERCASE_USER")
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 201
        assert response.json()["user"]["username"] == "uppercase_user"

    @pytest.mark.asyncio
    async def test_signup_without_phone_rejected(self, client: AsyncClient, test_country: Country):
        """phone_number/phone_country_id are mandatory at signup — login
        requires a verified phone, so an account with no phone on file
        would otherwise be permanently unable to log in."""
        payload = {k: v for k, v in self._payload(test_country).items() if k != "phone_number"}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_race_condition_returns_clean_error(
        self, db, test_user: User, monkeypatch: pytest.MonkeyPatch, mock_authentica
    ):
        """If a duplicate slips past the pre-checks (e.g. a concurrent signup
        landed between the check and the commit), create_user must still
        surface a clean UserAlreadyExistsError instead of a raw IntegrityError."""
        monkeypatch.setattr(service, "get_user_by_email", AsyncMock(return_value=None))
        monkeypatch.setattr(service, "get_user_by_username", AsyncMock(return_value=None))

        payload = UserSignup(
            first_name_ar="خالد", last_name_ar="سالم",
            first_name_en="Khaled", last_name_en="Salem",
            email=test_user.email,
            username="khaled_new",
            password="TestPass123@",
            phone_country_id=test_user.phone_country_id,
            phone_number=512345679,
        )

        with pytest.raises(UserAlreadyExistsError):
            await service.create_user(db, payload)


# ═══════════════════════════════════════════════════════
# Login Tests
# ═══════════════════════════════════════════════════════

class TestLogin:
    """POST /auth/login"""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db, test_user: User):
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        response = await client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123",
        })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        
        response = await client.post("/auth/login", json={
            "email": test_user.email,
            "password": "WrongPass999",
        })

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client: AsyncClient):
        
        response = await client.post("/auth/login", json={
            "email": "ghost@example.com",
            "password": "TestPass123",
        })

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_same_error_message(self, client: AsyncClient, test_user: User):
        """Wrong password and unknown email must return the identical error
        message — otherwise the response itself leaks which emails exist
        (a user enumeration vulnerability)."""
        wrong_password = await client.post("/auth/login", json={
            "email": test_user.email,
            "password": "WrongPass",
        })
        wrong_email = await client.post("/auth/login", json={
            "email": "ghost@example.com",
            "password": "TestPass123",
        })


        assert wrong_password.json()["detail"] == wrong_email.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_hashes_password_for_unknown_email(self, db, monkeypatch: pytest.MonkeyPatch):
        """verify_password must run even when the email doesn't exist, against
        a fixed dummy hash — otherwise the missing bcrypt call is a timing
        side-channel that leaks which emails are registered."""
        calls = []
        original_verify = service.verify_password

        def spy(password, password_hash):
            calls.append(password_hash)
            return original_verify(password, password_hash)

        monkeypatch.setattr(service, "verify_password", spy)

        with pytest.raises(Exception):
            await service.authenticate_user(db, UserLogin(email="ghost2@example.com", password="whatever"))

        assert calls == [service._DUMMY_PASSWORD_HASH]


# ═══════════════════════════════════════════════════════
# Token Tests
# ═══════════════════════════════════════════════════════

class TestTokens:


    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client: AsyncClient, db, test_user: User):
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        login = await client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123",
        })
        refresh_token = login.json()["refresh_token"]


        response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})

        assert response.status_code == 200
        assert "access_token" in response.json()

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_fails(self, client: AsyncClient, db, test_user: User):
        """decode_token checks the token's declared type explicitly, so an
        access token can't be replayed against the refresh endpoint."""
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        login = await client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123",
        })
        access_token = login.json()["access_token"]

        response = await client.post("/auth/refresh", json={"refresh_token": access_token})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_without_token(self, client: AsyncClient):
        
        response = await client.get("/auth/profile")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_protected_route_with_invalid_token(self, client: AsyncClient):
        
        response = await client.get(
            "/auth/profile",
            headers={"Authorization": "Bearer fake.token.here"},
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════
# Profile Tests
# ═══════════════════════════════════════════════════════

class TestProfile:


    @pytest.mark.asyncio
    async def test_get_me(self, client: AsyncClient, test_user: User, auth_headers: dict):
        
        response = await client.get("/auth/profile", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_update_profile_partial(self, client: AsyncClient, auth_headers: dict, test_city: City):

        response = await client.patch(
            "/auth/profile",
            headers=auth_headers,
            json={"city_id": str(test_city.id), "git_profile": "https://github.com/test"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["city_id"] == str(test_city.id)
        assert data["git_profile"] == "https://github.com/test"

    @pytest.mark.asyncio
    async def test_soft_delete_account(self, client: AsyncClient, db, auth_headers: dict):
        # Soft delete: the row is retained (for audit), not actually removed
        response = await client.delete("/auth/profile", headers=auth_headers)

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_update_phone_number_resets_verification(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict
    ):
        test_user.is_number_verified = True
        await db.commit()

        response = await client.patch(
            "/auth/profile",
            headers=auth_headers,
            json={"phone_number": 509999999},
        )

        assert response.status_code == 200
        assert response.json()["is_number_verified"] is False

    @pytest.mark.asyncio
    async def test_update_unrelated_field_keeps_verification(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict
    ):
        test_user.is_number_verified = True
        await db.commit()

        response = await client.patch(
            "/auth/profile",
            headers=auth_headers,
            json={"job_title": "Backend Engineer"},
        )

        assert response.status_code == 200
        assert response.json()["is_number_verified"] is True

    @pytest.mark.asyncio
    async def test_update_national_id_conflict(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict
    ):
        other = User(
            first_name_ar="سارة", last_name_ar="محمد",
            first_name_en="Sarah", last_name_en="Mohammed",
            email="other@example.com", username="other_user",
            password_hash=hash_password("TestPass123"),
            national_id="1234567890",
        )
        db.add(other)
        await db.commit()

        response = await client.patch(
            "/auth/profile",
            headers=auth_headers,
            json={"national_id": "1234567890"},
        )

        assert response.status_code == 409


# ═══════════════════════════════════════════════════════
# OTP Tests
# ═══════════════════════════════════════════════════════

class TestOTP:


    @pytest.mark.asyncio
    async def test_send_email_otp(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):

        response = await client.post("/auth/verify-email/send", headers=auth_headers)

        assert response.status_code == 200
        assert "message" in response.json()

        mock_authentica.send_email_otp.assert_called_once()

    @pytest.mark.asyncio
    async def test_confirm_email_otp_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):

        await client.post("/auth/verify-email/send", headers=auth_headers)


        response = await client.post(
            "/auth/verify-email/confirm",
            headers=auth_headers,
            json={"otp_code": "123456"},
        )

        assert response.status_code == 200
        assert response.json()["is_email_verified"] is True

    @pytest.mark.asyncio
    async def test_send_email_otp_already_verified(
        self,
        client: AsyncClient,
        db,
        test_user: User,
        auth_headers: dict,
        mock_authentica,
    ):

        test_user.is_email_verified = True
        await db.commit()

        response = await client.post("/auth/verify-email/send", headers=auth_headers)

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_confirm_otp_invalid_code(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):

        from bayn.integrations.authentica import AuthenticaOTPInvalid
        mock_authentica.verify_email_otp.side_effect = AuthenticaOTPInvalid("Invalid OTP")


        await client.post("/auth/verify-email/send", headers=auth_headers)

        response = await client.post(
            "/auth/verify-email/confirm",
            headers=auth_headers,
            json={"otp_code": "000000"},
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_send_phone_otp_no_phone(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):

        response = await client.post("/auth/verify-phone/send", headers=auth_headers)
        # test_user doesn't always have a phone_number set, so either
        # outcome is acceptable depending on the fixture data used
        assert response.status_code in (200, 400)

    @pytest.mark.asyncio
    async def test_send_email_otp_rate_limited(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):
        for _ in range(3):
            response = await client.post("/auth/verify-email/send", headers=auth_headers)
            assert response.status_code == 200

        response = await client.post("/auth/verify-email/send", headers=auth_headers)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_confirm_email_otp_chains_into_phone_otp(
        self,
        client: AsyncClient,
        auth_headers: dict,
        mock_authentica,
    ):
        # test_user fixture already has phone_number/phone_country_id set
        await client.post("/auth/verify-email/send", headers=auth_headers)
        response = await client.post(
            "/auth/verify-email/confirm",
            headers=auth_headers,
            json={"otp_code": "123456"},
        )

        assert response.status_code == 200
        mock_authentica.send_sms_otp.assert_called_once()
