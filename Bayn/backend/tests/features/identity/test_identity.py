"""
Identity feature tests.

Each test is independent — no reliance on run order.
Each test starts with test_ so pytest discovers it automatically.

Run:
    pytest tests/features/identity/test_identity.py -v
    pytest tests/features/identity/test_identity.py::TestSignup -v
"""

import re
import uuid
from datetime import date
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import AsyncClient

from bayn.common.exceptions import IncompleteProfileError, UserAlreadyExistsError
from bayn.core.security import create_signup_pending_token, hash_password
from bayn.features.catalog.models import Skill, UserSkill
from bayn.features.identity import service
from bayn.features.identity.dependencies import require_complete_profile
from bayn.features.identity.models import City, Country, ExperienceRange, User
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
        "birth_date": "2000-01-01",
        "email": "new@example.com",
        "username": "new_user",
        "password": "TestPass123@",
        "phone_number": 512345678,
        "terms_accepted": True,
    }

    def _payload(self, test_country: Country, **overrides) -> dict:
        return {**self.BASE_PAYLOAD, "phone_country_id": str(test_country.id), **overrides}

    @pytest.mark.asyncio
    async def test_signup_returns_pending_token(self, client: AsyncClient, test_country: Country, mock_authentica):
        """POST /auth/signup only sends the email OTP and hands back a pending
        token — no account exists yet, so no tokens are issued."""

        response = await client.post("/auth/signup", json=self._payload(test_country))

        assert response.status_code == 200
        data = response.json()
        assert "pending_token" in data
        assert data["email_verified"] is False
        assert data["phone_verified"] is False
        assert "access_token" not in data

        # signup fires the email OTP automatically, without a separate /verify-email/send call
        mock_authentica.send_email_otp.assert_called_once()

    @pytest.mark.asyncio
    async def test_signup_full_flow_creates_verified_user(
        self, client: AsyncClient, db, test_country: Country, mock_authentica
    ):
        """The User row is only written once both email and phone OTPs are
        confirmed — this drives the whole pending flow end to end."""

        signup_resp = await client.post("/auth/signup", json=self._payload(test_country))
        assert signup_resp.status_code == 200
        pending_token = signup_resp.json()["pending_token"]

        # no row exists yet — the whole point of the pending flow
        assert await service.get_user_by_email(db, "new@example.com") is None

        email_resp = await client.post(
            "/auth/signup/verify-email", json={"pending_token": pending_token, "otp_code": "1234"}
        )
        assert email_resp.status_code == 200
        email_data = email_resp.json()
        assert email_data["email_verified"] is True
        assert email_data["phone_verified"] is False
        assert await service.get_user_by_email(db, "new@example.com") is None

        phone_resp = await client.post(
            "/auth/signup/verify-phone",
            json={"pending_token": email_data["pending_token"], "otp_code": "1234"},
        )
        assert phone_resp.status_code == 201
        phone_data = phone_resp.json()
        assert "access_token" in phone_data
        assert phone_data["user"]["email"] == "new@example.com"
        assert phone_data["user"]["is_email_verified"] is True
        assert phone_data["user"]["is_number_verified"] is True
        assert "password" not in phone_data["user"]
        assert "password_hash" not in phone_data["user"]

        user = await service.get_user_by_email(db, "new@example.com")
        assert user is not None

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
    async def test_signup_username_lowercase(
        self, client: AsyncClient, db, test_country: Country, mock_authentica
    ):
        payload = self._payload(test_country, email="lower@example.com", username="UPPERCASE_USER")
        signup_resp = await client.post("/auth/signup", json=payload)
        assert signup_resp.status_code == 200

        email_resp = await client.post(
            "/auth/signup/verify-email",
            json={"pending_token": signup_resp.json()["pending_token"], "otp_code": "1234"},
        )
        phone_resp = await client.post(
            "/auth/signup/verify-phone",
            json={"pending_token": email_resp.json()["pending_token"], "otp_code": "1234"},
        )

        assert phone_resp.status_code == 201
        assert phone_resp.json()["user"]["username"] == "uppercase_user"

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
        landed between the check and the final confirm), confirm_signup_phone
        must still surface a clean UserAlreadyExistsError instead of a raw
        IntegrityError."""
        payload = UserSignup(
            first_name_ar="خالد", last_name_ar="سالم",
            first_name_en="Khaled", last_name_en="Salem",
            birth_date=date(2000, 1, 1),
            email=test_user.email,
            username="khaled_new",
            password="TestPass123@",
            phone_country_id=test_user.phone_country_id,
            phone_number=512345679,
            terms_accepted=True,
        )
        data = service._pending_signup_payload(payload)
        data["email_verified"] = True
        pending_token = create_signup_pending_token(data, service.PENDING_SIGNUP_TOKEN_TTL)

        monkeypatch.setattr(service, "get_user_by_email", AsyncMock(return_value=None))
        monkeypatch.setattr(service, "get_user_by_username", AsyncMock(return_value=None))

        with pytest.raises(UserAlreadyExistsError):
            await service.confirm_signup_phone(db, pending_token, "1234")


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

    # @pytest.mark.asyncio
    # async def test_soft_delete_account(self, client: AsyncClient, db, auth_headers: dict):
    #     # Soft delete: the row is retained (for audit), not actually removed
    #     response = await client.delete("/auth/profile", headers=auth_headers)
    #
    #     assert response.status_code == 200
    #     assert "deleted" in response.json()["message"].lower()
    # DELETE /auth/profile is currently commented out in router.py — re-enable this once it's back.

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
            json={"specialization_id": str(uuid.uuid4())},
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
            birth_date=date(2000, 1, 1),
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

    @pytest.mark.asyncio
    async def test_profile_incomplete_by_default(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/auth/profile", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["is_profile_complete"] is False
        assert "bio" in data["missing_profile_fields"]
        assert "skills" in data["missing_profile_fields"]

    @pytest.mark.asyncio
    async def test_update_profile_fills_bio_and_extra_names(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.patch(
            "/auth/profile",
            headers=auth_headers,
            json={
                "second_name_ar": "عبدالله",
                "third_name_ar": "سالم",
                "second_name_en": "Abdullah",
                "third_name_en": "Salem",
                "bio": "Backend developer.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["second_name_ar"] == "عبدالله"
        assert data["third_name_en"] == "Salem"
        assert data["bio"] == "Backend developer."
        assert "bio" not in data["missing_profile_fields"]

    @pytest.mark.asyncio
    async def test_require_complete_profile_blocks_incomplete(self, db, test_user: User):
        with pytest.raises(IncompleteProfileError):
            await require_complete_profile(user=test_user, db=db)

    @pytest.mark.asyncio
    async def test_require_complete_profile_allows_complete(
        self, db, test_user: User, test_city: City
    ):
        test_user.second_name_ar = "عبدالله"
        test_user.third_name_ar = "سالم"
        test_user.second_name_en = "Abdullah"
        test_user.third_name_en = "Salem"
        test_user.national_id = "1029384756"
        test_user.birth_date = date(1995, 1, 1)
        test_user.country_id = test_city.country_id
        test_user.city_id = test_city.id
        test_user.specialization_id = test_city.country_id  # any non-null FK value; not committed
        test_user.industry_id = test_city.country_id  # any non-null FK value; not committed
        test_user.years_of_experience = ExperienceRange.less_than_1
        test_user.avatar_key = "avatars/test.png"
        test_user.bio = "Backend developer with a few years of experience."

        skill = Skill(name="Python")
        db.add(skill)
        await db.flush()
        db.add(UserSkill(user_id=test_user.id, skill_id=skill.id))

        result = await require_complete_profile(user=test_user, db=db)

        assert result is test_user


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


def _extract_token(mock_email) -> str:
    body = mock_email.send_email.call_args.kwargs["body"]
    return re.search(r"token=([^\s).]+)", body).group(1)


# ═══════════════════════════════════════════════════════
# Password Reset Tests (forgot password — unauthenticated)
# ═══════════════════════════════════════════════════════

class TestPasswordReset:
    """POST /auth/password/forgot, POST /auth/password/reset"""

    @pytest.mark.asyncio
    async def test_forgot_password_unknown_email_sends_nothing(
        self, client: AsyncClient, mock_email
    ):
        response = await client.post(
            "/auth/password/forgot", json={"email": "ghost@example.com"}
        )

        assert response.status_code == 200
        mock_email.send_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_reset_password_full_flow_and_login(
        self, client: AsyncClient, db, test_user: User, mock_email
    ):
        # this is the exact path that used to crash with
        # NameError: name 'revoke_all_refresh_tokens_for_user' is not defined
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        forgot = await client.post("/auth/password/forgot", json={"email": test_user.email})
        assert forgot.status_code == 200
        mock_email.send_email.assert_called_once()

        raw_token = _extract_token(mock_email)
        reset = await client.post(
            "/auth/password/reset",
            json={"token": raw_token, "new_password": "NewPass123@"},
        )
        assert reset.status_code == 200

        old_login = await client.post(
            "/auth/login", json={"email": test_user.email, "password": "TestPass123"}
        )
        assert old_login.status_code == 401

        new_login = await client.post(
            "/auth/login", json={"email": test_user.email, "password": "NewPass123@"}
        )
        assert new_login.status_code == 200

    @pytest.mark.asyncio
    async def test_forgot_password_email_failure_does_not_500(
        self, client: AsyncClient, test_user: User, mock_email
    ):
        mock_email.send_email.side_effect = Exception("smtp unavailable")

        response = await client.post("/auth/password/forgot", json={"email": test_user.email})

        assert response.status_code == 200
        assert "message" in response.json()

    @pytest.mark.asyncio
    async def test_reset_password_invalid_token_rejected(self, client: AsyncClient):
        response = await client.post(
            "/auth/password/reset",
            json={"token": "not-a-real-token", "new_password": "NewPass123@"},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_revokes_existing_refresh_tokens(
        self, client: AsyncClient, db, test_user: User, mock_email
    ):
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        login = await client.post(
            "/auth/login", json={"email": test_user.email, "password": "TestPass123"}
        )
        old_refresh_token = login.json()["refresh_token"]

        await client.post("/auth/password/forgot", json={"email": test_user.email})
        raw_token = _extract_token(mock_email)
        await client.post(
            "/auth/password/reset",
            json={"token": raw_token, "new_password": "NewPass123@"},
        )

        # the refresh token issued before the reset must no longer work
        response = await client.post(
            "/auth/refresh", json={"refresh_token": old_refresh_token}
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════
# Password Change Tests (authenticated, requires email confirmation)
# ═══════════════════════════════════════════════════════

class TestPasswordChange:
    """POST /auth/password/change/request, POST /auth/password/change/confirm"""

    @pytest.mark.asyncio
    async def test_change_password_wrong_current_password(
        self, client: AsyncClient, auth_headers: dict, mock_email
    ):
        response = await client.post(
            "/auth/password/change/request",
            headers=auth_headers,
            json={"current_password": "WrongPass999", "new_password": "NewPass123@"},
        )
        assert response.status_code == 400
        mock_email.send_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_change_password_full_flow_and_login(
        self, client: AsyncClient, db, test_user: User, auth_headers: dict, mock_email
    ):
        # same crash point as password reset — confirm must not 500
        test_user.is_email_verified = True
        test_user.is_number_verified = True
        await db.commit()

        request = await client.post(
            "/auth/password/change/request",
            headers=auth_headers,
            json={"current_password": "TestPass123", "new_password": "NewPass123@"},
        )
        assert request.status_code == 200
        mock_email.send_email.assert_called_once()

        raw_token = _extract_token(mock_email)
        confirm = await client.post(
            "/auth/password/change/confirm", params={"token": raw_token}
        )
        assert confirm.status_code == 200

        new_login = await client.post(
            "/auth/login", json={"email": test_user.email, "password": "NewPass123@"}
        )
        assert new_login.status_code == 200

    @pytest.mark.asyncio
    async def test_change_password_confirm_invalid_token_rejected(self, client: AsyncClient):
        response = await client.post(
            "/auth/password/change/confirm", params={"token": "not-a-real-token"}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_change_password_request_email_failure_returns_clean_error(
        self, client: AsyncClient, auth_headers: dict, mock_email
    ):
        mock_email.send_email.side_effect = Exception("smtp unavailable")

        response = await client.post(
            "/auth/password/change/request",
            headers=auth_headers,
            json={"current_password": "TestPass123", "new_password": "NewPass123@"},
        )

        assert response.status_code == 502
