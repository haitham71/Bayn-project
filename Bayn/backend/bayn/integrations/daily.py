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

import base64
import hashlib
import hmac

import httpx

from bayn.core.config import settings


def verify_webhook_signature(timestamp: str, raw_body: bytes, signature: str) -> bool:
    """Verify a Daily.co webhook call.

    Daily signs `"{timestamp}.{raw_json_body}"` with HMAC-SHA256 using the
    base64-decoded webhook secret, then base64-encodes the digest — compared
    against the X-Webhook-Signature header. DAILY_WEBHOOK_SECRET must be the
    same secret given to Daily's `/webhooks` create call (its "hmac" field).
    """
    if not settings.DAILY_WEBHOOK_SECRET:
        return False

    secret = base64.b64decode(settings.DAILY_WEBHOOK_SECRET)
    message = timestamp.encode() + b"." + raw_body
    expected = base64.b64encode(hmac.new(secret, message, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature)


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

    async def create_room(
        self,
        name: str,
        exp_epoch_seconds: int | None = None,
        nbf_epoch_seconds: int | None = None,
        enable_recording: str | None = None,
    ) -> dict:
        """
        Create a video call room.

        POST /rooms
        Body: { "name": "<room>", "properties": { "nbf": <unix_ts>, "exp": <unix_ts> } }

        Args:
            exp_epoch_seconds: nobody can connect after this time.
            nbf_epoch_seconds: nobody can connect before this time. Daily enforces
                this itself, so holding the room URL early is not enough to get in.
            enable_recording: e.g. "cloud" to record every call in this room to
                Daily's storage — pulled into our own R2 bucket once the
                "recording.ready-to-download" webhook fires (see meetings.service).

        Returns:
            Daily's room object — includes "url", the joinable video link
            (e.g. "https://bayn.daily.co/<name>").

        Raises:
            DailyError: on any non-2xx response
        """
        properties = {}
        if exp_epoch_seconds is not None:
            properties["exp"] = exp_epoch_seconds
        if nbf_epoch_seconds is not None:
            properties["nbf"] = nbf_epoch_seconds
        if enable_recording is not None:
            properties["enable_recording"] = enable_recording

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

    async def get_recording_access_link(self, recording_id: str) -> str:
        """
        GET /recordings/{id}/access-link

        Returns a temporary signed URL to download the finished recording —
        called after the "recording.ready-to-download" webhook fires.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self._base_url}/recordings/{recording_id}/access-link",
                    headers=self._headers(),
                )
            except httpx.HTTPError as exc:
                raise DailyError(f"Could not reach Daily.co: {exc}") from exc

        if not response.is_success:
            raise DailyError(f"Failed to get recording access link: {response.text}")

        data = response.json()
        # documented as "download_link" — fall back to "link" defensively in
        # case Daily's field name differs from what's on record
        return data.get("download_link") or data["link"]

    async def create_meeting_token(
        self,
        room_name: str,
        user_name: str,
        exp_epoch_seconds: int | None = None,
        is_owner: bool = False,
    ) -> str:
        """
        Mint a single-use meeting token that joins `room_name` as `user_name`.

        POST /meeting-tokens

        Joining via {room_url}?t={token} makes Daily use `user_name` for the
        participant instead of prompting for one — so a joiner enters under
        their real platform name and can't type someone else's.

        Args:
            user_name: the display name Daily shows for this participant.
            exp_epoch_seconds: the token stops working after this time; align it
                with the room's own exp so a leaked token can't outlive the room.
            is_owner: grant Daily owner privileges (kick, mute) to this token.

        Returns:
            The token string, to append as the `?t=` query parameter.

        Raises:
            DailyError: on any non-2xx response or a connection failure
        """
        properties = {"room_name": room_name, "user_name": user_name, "is_owner": is_owner}
        if exp_epoch_seconds is not None:
            properties["exp"] = exp_epoch_seconds

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self._base_url}/meeting-tokens",
                    headers=self._headers(),
                    json={"properties": properties},
                )
            except httpx.HTTPError as exc:
                raise DailyError(f"Could not reach Daily.co: {exc}") from exc

        if not response.is_success:
            raise DailyError(f"Failed to create Daily meeting token: {response.text}")

        return response.json()["token"]

    async def delete_room(self, name: str) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self._base_url}/rooms/{name}",
                headers=self._headers(),
            )

        if not response.is_success and response.status_code != 404:
            raise DailyError(f"Failed to delete Daily room: {response.text}")


daily_client = DailyClient()
