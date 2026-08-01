"""
NDA Service Integration — Signature-System external API by haitham.

Signature-System owns the NDA signing flow end-to-end (emailing signing
links, capturing signatures, generating PDFs). This app only creates
contracts and polls their status — it never touches Signature-System's
database directly.

Full API reference: see API.md in the Signature-System repo.

────────────────────────────────────────────────────────────
QUICK REFERENCE
────────────────────────────────────────────────────────────
Auth       : X-API-Key: <api_key>
Create     : POST /api/v1/contracts
Get status : GET  /api/v1/contracts/{id}

`meeting_id`, `project_id`, `party_one_user_id`, `party_two_user_id` are
opaque UUIDs from this app — Signature-System stores them as-is without
validating or dereferencing them, purely so a contract can be correlated
back to a meeting/project/user on this side.
────────────────────────────────────────────────────────────
"""

import httpx

from bayn.core.config import settings


# Exceptions

class NDAServiceError(Exception):
    """
    Raised when the NDA Service (Signature-System) API call fails.
    Covers: network errors, 5xx server errors, bad credentials (401),
    validation errors (400), and any unexpected non-2xx response.
    """
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NDAContractNotFound(NDAServiceError):
    """Raised when GET /api/v1/contracts/{id} returns HTTP 404."""
    pass


# Client


class NDAServiceClient:
    """
    Async HTTP client for Signature-System's external API.

    Uses httpx.AsyncClient (not requests) because this runs inside
    FastAPI's async event loop — blocking HTTP calls would freeze
    the server for all other requests.

    Instantiate once at module level (singleton pattern) and import
    wherever NDA contract creation/status is needed.
    """

    def __init__(self) -> None:
        self._base_url = settings.NDA_SERVICE_URL   # e.g. http://host.docker.internal:5000
        self._api_key = settings.NDA_SERVICE_KEY
        self._timeout = 15.0

    def _headers(self) -> dict[str, str]:
        return {
            "X-API-Key": self._api_key,
            "Content-Type": "application/json",
        }

    async def create_contract(
        self,
        *,
        party_one_name: str,
        party_one_national_id: str,
        party_one_email: str,
        party_two_name: str,
        party_two_national_id: str,
        party_two_email: str,
        contract_type: str = "nda",
        meeting_id: str | None = None,
        project_id: str | None = None,
        party_one_user_id: str | None = None,
        party_two_user_id: str | None = None,
        confidentiality_period_months: int | None = None,
        idea_title: str | None = None,
    ) -> dict:
        """
        Create a new contract. Signature-System emails party one their
        signing link as soon as this call succeeds.

        POST /api/v1/contracts

        Returns:
            The created contract as a dict (see API.md for the full shape),
            including "id" (the contract's UUID, used for later lookups)
            and "party_one_signing_link".

        Raises:
            NDAServiceError: on any non-2xx response
        """
        body = {
            "contract_type": contract_type,
            "meeting_id": meeting_id,
            "project_id": project_id,
            "confidentiality_period_months": confidentiality_period_months,
            "party_one_user_id": party_one_user_id,
            "party_one_name": party_one_name,
            "party_one_national_id": party_one_national_id,
            "party_one_email": party_one_email,
            "party_two_user_id": party_two_user_id,
            "party_two_name": party_two_name,
            "party_two_national_id": party_two_national_id,
            "party_two_email": party_two_email,
            "idea_title": idea_title,
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/v1/contracts",
                headers=self._headers(),
                json=body,
            )

        if not response.is_success:
            raise NDAServiceError(
                f"Failed to create NDA contract | "
                f"status={response.status_code} | body={response.text}"
            )

        return response.json()

    async def get_contract(self, contract_id: str) -> dict:
        """
        Fetch a contract's current status and data.

        GET /api/v1/contracts/{id}

        Args:
            contract_id: the UUID returned as "id" by create_contract

        Returns:
            The contract as a dict — see API.md. `status` is one of
            "pending_party_one", "pending_party_two", "signed".

        Raises:
            NDAContractNotFound: HTTP 404 — no contract with that id
            NDAServiceError:     any other non-2xx response
        """
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.get(
                f"{self._base_url}/api/v1/contracts/{contract_id}",
                headers=self._headers(),
            )

        if response.status_code == 404:
            raise NDAContractNotFound(f"No NDA contract found with id={contract_id}")

        if not response.is_success:
            raise NDAServiceError(
                f"Failed to fetch NDA contract | "
                f"status={response.status_code} | body={response.text}"
            )

        return response.json()



# Singleton

# One shared instance for the entire application.
# Import it wherever NDA contract operations are needed:
#
#   from bayn.integrations.nda_service import nda_service_client
#
# Don't create new NDAServiceClient() instances inside functions —
# that would rebuild the object on every request for no benefit.
nda_service_client = NDAServiceClient()
