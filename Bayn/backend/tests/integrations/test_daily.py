"""Daily.co client tests — mocks httpx, no real API calls."""

import base64
import hashlib
import hmac

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from bayn.core.config import settings
from bayn.integrations.daily import DailyClient, DailyError, verify_webhook_signature


def _sign(secret_b64: str, timestamp: str, body: bytes) -> str:
    secret = base64.b64decode(secret_b64)
    message = timestamp.encode() + b"." + body
    return base64.b64encode(hmac.new(secret, message, hashlib.sha256).digest()).decode()


class TestVerifyWebhookSignature:

    def test_valid_signature_accepted(self):
        secret = base64.b64encode(b"super-secret").decode()
        body = b'{"type": "recording.ready-to-download"}'
        timestamp = "1700000000"
        signature = _sign(secret, timestamp, body)

        with patch.object(settings, "DAILY_WEBHOOK_SECRET", secret):
            assert verify_webhook_signature(timestamp, body, signature) is True

    def test_tampered_body_rejected(self):
        secret = base64.b64encode(b"super-secret").decode()
        timestamp = "1700000000"
        signature = _sign(secret, timestamp, b'{"type": "a"}')

        with patch.object(settings, "DAILY_WEBHOOK_SECRET", secret):
            assert verify_webhook_signature(timestamp, b'{"type": "b"}', signature) is False

    def test_wrong_secret_rejected(self):
        real_secret = base64.b64encode(b"super-secret").decode()
        wrong_secret = base64.b64encode(b"wrong-secret").decode()
        timestamp = "1700000000"
        body = b'{"type": "a"}'
        signature = _sign(wrong_secret, timestamp, body)

        with patch.object(settings, "DAILY_WEBHOOK_SECRET", real_secret):
            assert verify_webhook_signature(timestamp, body, signature) is False

    def test_no_secret_configured_rejects_everything(self):
        with patch.object(settings, "DAILY_WEBHOOK_SECRET", None):
            assert verify_webhook_signature("1700000000", b"{}", "anything") is False


class TestGetRecordingAccessLink:

    def setup_method(self):
        self.client = DailyClient()

    @pytest.mark.asyncio
    async def test_returns_download_link(self):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {"download_link": "https://daily-recordings.s3.amazonaws.com/x.mp4"}

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            link = await self.client.get_recording_access_link("rec-123")

        assert link == "https://daily-recordings.s3.amazonaws.com/x.mp4"

    @pytest.mark.asyncio
    async def test_raises_on_failure_response(self):
        mock_response = MagicMock()
        mock_response.is_success = False
        mock_response.text = "not found"

        with patch("httpx.AsyncClient") as mock_http:
            mock_http.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            with pytest.raises(DailyError):
                await self.client.get_recording_access_link("rec-123")
