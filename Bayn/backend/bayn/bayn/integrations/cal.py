"""Cal.com integration client — booking and scheduling.

Mirrors the structure of integrations/authentica.py: a singleton client,
custom exceptions, and thin async methods that translate Cal.com's API
into typed responses/errors for the service layer to consume.
"""

import httpx

from bayn.core.config import settings

CALCOM_API_BASE = "https://api.cal.com/v2"


class CalComError(Exception):
    """Raised for any non-success response from Cal.com."""


class CalComBookingConflict(CalComError):
    """Raised when the requested slot is no longer available."""


class CalComClient:
    def __init__(self) -> None:
        self.api_key = settings.CALCOM_API_KEY
        self.client_id = settings.CALCOM_CLIENT_ID
        self.client_secret = settings.CALCOM_CLIENT_SECRET

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "cal-api-version": "2024-08-13",
        }

    async def get_available_slots(self, event_type_id: str, start_date: str, end_date: str) -> list[dict]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{CALCOM_API_BASE}/slots",
                headers=self._headers(),
                params={
                    "eventTypeId": event_type_id,
                    "startTime": start_date,
                    "endTime": end_date,
                },
            )

        if not response.is_success:
            raise CalComError(f"Failed to fetch available slots: {response.text}")

        return response.json().get("data", [])

    async def create_booking(
        self,
        event_type_id: str,
        start_time: str,
        attendee_email: str,
        attendee_name: str,
        length_minutes: int | None = None,
    ) -> dict:
        # length_minutes must be one of the event type's configured
        # lengthInMinutesOptions (Cal.com rejects arbitrary values) — the
        # caller is responsible for rounding to an allowed option
        body = {
            "eventTypeId": event_type_id,
            "start": start_time,
            "attendee": {
                "email": attendee_email,
                "name": attendee_name,
            },
        }
        if length_minutes is not None:
            body["lengthInMinutes"] = length_minutes

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CALCOM_API_BASE}/bookings",
                headers=self._headers(),
                json=body,
            )

        # Cal.com returns 409 specifically when the slot got taken meanwhile
        if response.status_code == 409:
            raise CalComBookingConflict("This time slot is no longer available")

        if not response.is_success:
            raise CalComError(f"Failed to create booking: {response.text}")

        return response.json()

    async def cancel_booking(self, booking_uid: str, reason: str = "") -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CALCOM_API_BASE}/bookings/{booking_uid}/cancel",
                headers=self._headers(),
                json={"cancellationReason": reason},
            )

        if not response.is_success:
            raise CalComError(f"Failed to cancel booking: {response.text}")

    async def reschedule_booking(self, booking_uid: str, new_start_time: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CALCOM_API_BASE}/bookings/{booking_uid}/reschedule",
                headers=self._headers(),
                json={"start": new_start_time},
            )

        if response.status_code == 409:
            raise CalComBookingConflict("This time slot is no longer available")

        if not response.is_success:
            raise CalComError(f"Failed to reschedule booking: {response.text}")

        return response.json()


calcom_client = CalComClient()
