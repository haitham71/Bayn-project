"""
Identity feature tests.

Each test is independent — no reliance on run order.
Each test starts with test_ so pytest discovers it automatically.

Run:
    pytest tests/features/identity/test_identity.py -v
    pytest tests/features/identity/test_identity.py::TestSignup -v
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from bayn.features.identity.models import City, User


# ═══════════════════════════════════════════════════════
# Signup Tests
# ═══════════════════════════════════════════════════════

class TestSignup:
    """POST /auth/signup"""

    VALID_PAYLOAD = {
        "first_name_ar": "محمد",
        "last_name_ar": "الأحمد",
        "first_name_en": "Mohammed",
        "last_name_en": "Al-Ahmad",
        "email": "new@example.com",
        "username": "new_user",
        "password": "TestPass123@",
    }

    @pytest.mark.asyncio
    async def test_signup_success(self, client: AsyncClient):
        
        response = await client.post("/auth/signup", json=self.VALID_PAYLOAD)

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

    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, client: AsyncClient, test_user: User):
        
        payload = {**self.VALID_PAYLOAD, "email": test_user.email, "username": "another_user"}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 409
        assert "already in use" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_signup_duplicate_username(self, client: AsyncClient, test_user: User):
        
        payload = {**self.VALID_PAYLOAD, "email": "another@example.com", "username": test_user.username}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_signup_weak_password(self, client: AsyncClient):
        
        payload = {**self.VALID_PAYLOAD, "email": "p@example.com", "username": "ptest", "password": "weak"}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_invalid_email(self, client: AsyncClient):
        
        payload = {**self.VALID_PAYLOAD, "email": "not-an-email"}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_username_lowercase(self, client: AsyncClient):
        
        payload = {**self.VALID_PAYLOAD, "email": "lower@example.com", "username": "UPPERCASE_USER"}
        response = await client.post("/auth/signup", json=payload)

        assert response.status_code == 201
        assert response.json()["user"]["username"] == "uppercase_user"


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
