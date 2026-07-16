"""
Authentica Integration — OTP via Email & SMS.

Official docs : https://authenticasa.docs.apiary.io/#reference
GitHub        : https://github.com/AuthenticaSA/Authentica
Portal        : https://portal.authentica.sa

────────────────────────────────────────────────────────────
QUICK REFERENCE
────────────────────────────────────────────────────────────
Base URL  : https://api.authentica.sa
Auth      : X-Authorization: <api_key>
Headers   : Accept: application/json
            Content-Type: application/json

Send OTP  : POST /api/v2/send-otp
Verify OTP: POST /api/v2/verify-otp
Balance   : GET  /api/v2/balance

────────────────────────────────────────────────────────────
OTP FLOW
────────────────────────────────────────────────────────────
1. App → POST /api/v2/send-otp  → Authentica delivers OTP to user
2. User enters code in your app
3. App → POST /api/v2/verify-otp → { verified: true/false }

KEY NOTES:
- Authentica v2 does NOT return a reference_id.
  Verification uses (email/phone + otp) directly.
- Phone numbers must be E.164 format: +9665XXXXXXXX
- Email OTP is FREE. SMS uses credits.
- OTP never passes through your server — Authentica handles it.

────────────────────────────────────────────────────────────
SEND OTP — Request body variants
────────────────────────────────────────────────────────────
SMS:
    { "method": "sms",   "phone": "+9665XXXXXXXX" }

Email:
    { "method": "email", "email": "user@example.com" }

────────────────────────────────────────────────────────────
VERIFY OTP — Request body variants
────────────────────────────────────────────────────────────
SMS:
    { "phone": "+9665XXXXXXXX", "otp": "123456" }

Email:
    { "email": "user@example.com", "otp": "123456" }

────────────────────────────────────────────────────────────
COMMON ERRORS
────────────────────────────────────────────────────────────
401  → Wrong X-Authorization key or account suspended
400  → OTP wrong / expired, or invalid phone/email format
429  → Rate limit hit — slow down requests
────────────────────────────────────────────────────────────
"""

import httpx

from bayn.core.config import settings


# ─────────────────────────────────────────────
# Exceptions
# ─────────────────────────────────────────────

class AuthenticaError(Exception):
    """
    Raised when the Authentica API call fails.
    Covers: network errors, 5xx server errors, bad credentials (401),
    rate limits (429), and any unexpected non-2xx response.
    """
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class AuthenticaOTPInvalid(AuthenticaError):
    """
    Raised when OTP verification returns HTTP 400.
    Means: the code entered by the user is wrong or has expired.
    The user should be prompted to request a new code.
    """
    pass


# ─────────────────────────────────────────────
# Client
# ─────────────────────────────────────────────

class AuthenticaClient:
    """
    Async HTTP client for Authentica API v2.

    Uses httpx.AsyncClient (not requests) because this runs inside
    FastAPI's async event loop — blocking HTTP calls would freeze
    the server for all other requests.

    Instantiate once at module level (singleton pattern) and import
    wherever OTP sending/verifying is needed.
    """

    def __init__(self) -> None:
        self._base_url = settings.AUTHENTICA_BASE_URL   # e.g. https://api.authentica.sa
        self._api_key  = settings.AUTHENTICA_API_KEY    # from .env — note: may contain $
        self._timeout  = 10.0                           # seconds before giving up

    def _headers(self) -> dict[str, str]:
        """
        Standard headers for every Authentica request.
        X-Authorization is Authentica's specific header name — not Bearer.
        """
        return {
            "X-Authorization": self._api_key,
            "Content-Type":    "application/json",
            "Accept":          "application/json",
        }

    # ─── Send OTP ─────────────────────────────────────────────────────────

    async def send_email_otp(self, email: str) -> None:
        """
        Send OTP to an email address (FREE — no credits used).

        POST /api/v2/send-otp
        Body: { "method": "email", "email": "<email>" }

        Args:
            email: recipient email address

        Returns:
            None — v2 API does not return a reference_id

        Raises:
            AuthenticaError: on any non-2xx response
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/v2/send-otp",
                headers=self._headers(),
                json={"method": "email", "email": email},
            )

        if not response.is_success:
            raise AuthenticaError(
                f"Failed to send email OTP | "
                f"status={response.status_code} | body={response.text}"
            )

    async def send_sms_otp(self, dial_code: str, phone_number: int) -> None:
        """
        Send OTP via SMS (uses credits).

        POST /api/v2/send-otp
        Body: { "method": "sms", "phone": "+9665XXXXXXXX" }

        Args:
            dial_code:    country dial code, e.g. "+966"
            phone_number: local number without country code, e.g. 501234567

        Returns:
            None — v2 API does not return a reference_id

        Raises:
            AuthenticaError: on any non-2xx response

        Note:
            E.164 is built by concatenating: dial_code + phone_number
            "+966" + 501234567 → "+966501234567"
        """
        full_phone = f"{dial_code}{phone_number}"

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/v2/send-otp",
                headers=self._headers(),
                json={"method": "sms", "phone": full_phone},
            )

        if not response.is_success:
            raise AuthenticaError(
                f"Failed to send SMS OTP | "
                f"status={response.status_code} | body={response.text}"
            )

    # ─── Verify OTP ───────────────────────────────────────────────────────

    async def verify_email_otp(self, email: str, otp_code: str) -> bool:
        """
        Verify an OTP code sent to an email address.

        POST /api/v2/verify-otp
        Body: { "email": "<email>", "otp": "<code>" }

        Args:
            email:    the same email used in send_email_otp
            otp_code: the code entered by the user

        Returns:
            True on success

        Raises:
            AuthenticaOTPInvalid: HTTP 400 — code is wrong or expired
            AuthenticaError:      any other non-2xx response
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/v2/verify-otp",
                headers=self._headers(),
                json={"email": email, "otp": otp_code},
            )

        if response.status_code == 400:
            raise AuthenticaOTPInvalid("Invalid or expired OTP — ask user to request a new code")

        if not response.is_success:
            raise AuthenticaError(
                f"Email OTP verification failed | "
                f"status={response.status_code} | body={response.text}"
            )

        return True

    async def verify_sms_otp(
        self,
        dial_code: str,
        phone_number: int,
        otp_code: str,
    ) -> bool:
        """
        Verify an OTP code sent via SMS.

        POST /api/v2/verify-otp
        Body: { "phone": "+9665XXXXXXXX", "otp": "<code>" }

        Args:
            dial_code:    country dial code, e.g. "+966"
            phone_number: local number, e.g. 501234567
            otp_code:     the code entered by the user

        Returns:
            True on success

        Raises:
            AuthenticaOTPInvalid: HTTP 400 — code is wrong or expired
            AuthenticaError:      any other non-2xx response
        """
        full_phone = f"{dial_code}{phone_number}"

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/v2/verify-otp",
                headers=self._headers(),
                json={"phone": full_phone, "otp": otp_code},
            )

        if response.status_code == 400:
            raise AuthenticaOTPInvalid("Invalid or expired OTP — ask user to request a new code")

        if not response.is_success:
            raise AuthenticaError(
                f"SMS OTP verification failed | "
                f"status={response.status_code} | body={response.text}"
            )

        return True

    # ─── Utilities ────────────────────────────────────────────────────────

    async def check_balance(self) -> dict:
        """
        Check remaining Authentica credits.

        GET /api/v2/balance
        Response: { "data": { "balance": 21934 } }

        Useful to monitor before sending bulk OTPs.
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._base_url}/api/v2/balance",
                headers=self._headers(),
            )

        if not response.is_success:
            raise AuthenticaError(
                f"Failed to fetch balance | "
                f"status={response.status_code} | body={response.text}"
            )

        return response.json()


# ─────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────

# One shared instance for the entire application.
# Import it wherever OTP operations are needed:
#
#   from bayn.integrations.authentica import authentica_client
#
# Don't create new AuthenticaClient() instances inside functions —
# that would rebuild the object on every request for no benefit.
authentica_client = AuthenticaClient()
