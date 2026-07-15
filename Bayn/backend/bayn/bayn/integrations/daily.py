"""Daily.co integration client — video call room creation.

Mirrors the structure of integrations/authentica.py and integrations/cal.py if we laky:
a singleton client, custom exceptions, and thin async methods.

DAILY_API_URL is the REST API base (https://api.daily.co/v1) — used for
authenticated requests to create/delete rooms.

DAILY_DOMAIN is the account's video-call subdomain (e.g. bayn.daily.co).
Daily's room-creation response already includes a full joinable "url" built
from this domain, so callers should read `url` from create_room()'s return
value rather than concatenating DAILY_DOMAIN themselves.
"""

import httpx

from bayn.core.config import settings


class DailyError(Exception):
    """Raised for any non-success response from Daily.co."""


class DailyClient:
    def __init__(self) -> None:
        self._base_url = settings.DAILY_API_URL
        self._api_key = settings.DAILY_API_KEY

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def create_room(self, name: str, exp_epoch_seconds: int | None = None) -> dict:
        """
        Create a video call room.

        POST /rooms
        Body: { "name": "<room>", "properties": { "exp": <unix_ts> } }

        Returns:
            Daily's room object — includes "url", the joinable video link
            (e.g. "https://bayn.daily.co/<name>").

        Raises:
            DailyError: on any non-2xx response
        """
        properties = {}
        if exp_epoch_seconds is not None:
            properties["exp"] = exp_epoch_seconds

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self._base_url}/rooms",
                    headers=self._headers(),
                    json={"name": name, "properties": properties},
                )
            except httpx.HTTPError as exc:
                # connection/timeout/DNS failure — surface as DailyError so the
                # caller can handle it cleanly instead of a raw 500
                raise DailyError(f"Could not reach Daily.co: {exc}") from exc

        if not response.is_success:
            raise DailyError(f"Failed to create Daily room: {response.text}")

        return response.json()

    async def delete_room(self, name: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self._base_url}/rooms/{name}",
                headers=self._headers(),
            )

        if not response.is_success and response.status_code != 404:
            raise DailyError(f"Failed to delete Daily room: {response.text}")


daily_client = DailyClient()
