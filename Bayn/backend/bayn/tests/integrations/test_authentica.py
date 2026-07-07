"""Authentica client tests — mocks httpx so no real API calls are made.

Run: pytest tests/integrations/test_authentica.py -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from bayn.integrations.authentica import (
    AuthenticaClient,
    AuthenticaError,
    AuthenticaOTPInvalid,
)


class TestAuthenticaClient:

    def setup_method(self):
        self.client = AuthenticaClient()

    @pytest.mark.asyncio
    async def test_send_email_otp_success(self):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {"success": True}

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            await self.client.send_email_otp("user@example.com")

    @pytest.mark.asyncio
    async def test_send_email_otp_failure(self):
        mock_response = MagicMock()
        mock_response.is_success = False
        mock_response.text = "Service unavailable"

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            with pytest.raises(AuthenticaError):
                await self.client.send_email_otp("user@example.com")

    @pytest.mark.asyncio
    async def test_send_sms_otp_e164_format(self):
        sent_body = {}

        async def capture_request(url, headers, json):
            sent_body.update(json)
            mock_resp = MagicMock()
            mock_resp.is_success = True
            return mock_resp

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(side_effect=capture_request)
            await self.client.send_sms_otp("+966", 501234567)

        # dial_code + number must concatenate into E.164
        assert sent_body.get("phone") == "+966501234567"
        assert sent_body.get("method") == "sms"

    @pytest.mark.asyncio
    async def test_verify_email_otp_success(self):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            result = await self.client.verify_email_otp("user@example.com", "123456")
            assert result is True

    @pytest.mark.asyncio
    async def test_verify_email_otp_invalid_code(self):
        # Authentica returns 400 for a wrong/expired code
        mock_response = MagicMock()
        mock_response.is_success = False
        mock_response.status_code = 400

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
            with pytest.raises(AuthenticaOTPInvalid):
                await self.client.verify_email_otp("user@example.com", "000000")

    @pytest.mark.asyncio
    async def test_headers_use_x_authorization(self):
        # Authentica requires X-Authorization, not the standard Bearer header
        headers = self.client._headers()
        assert "X-Authorization" in headers
        assert "Authorization" not in headers

    @pytest.mark.asyncio
    async def test_verify_sms_otp_correct_body(self):
        sent_body = {}

        async def capture_request(url, headers, json):
            sent_body.update(json)
            mock_resp = MagicMock()
            mock_resp.is_success = True
            mock_resp.status_code = 200
            return mock_resp

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.post = AsyncMock(side_effect=capture_request)
            await self.client.verify_sms_otp("+966", 501234567, "123456")

        assert sent_body.get("phone") == "+966501234567"
        assert sent_body.get("otp") == "123456"
        assert "email" not in sent_body
