"""Contracts router — NDA status, and Signature-System's callback.

There is no create endpoint: contracts are created by the meetings service when
an owner accepts a request, so the parties are always taken from our own user
rows rather than from whatever a client posts.
"""

import uuid

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import ForbiddenError, NotFoundError
from bayn.core.config import settings
from bayn.core.database import get_db
from bayn.core.i18n import DEFAULT_LOCALE, get_locale, t
from bayn.features.contracts import service
from bayn.features.contracts.models import Contract
from bayn.features.contracts.schemas import ContractResponse, ContractWebhookPayload
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.meetings import service as meetings_service
from bayn.features.meetings.models import MeetingRequest

router = APIRouter(prefix="/v1/contracts", tags=["Contracts"])


@router.get(
    "/{contract_id}/status",
    response_model=ContractResponse,
    summary="Fetch a contract's signing status (parties only)",
)
async def get_contract_status(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    locale: str = Depends(get_locale),
) -> ContractResponse:
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise NotFoundError(t("contracts", "errors.contract_not_found", locale))
    if current_user.id not in (contract.party_one_user_id, contract.party_two_user_id):
        raise ForbiddenError(t("contracts", "errors.not_a_party", locale))

    return await service.sync_and_get_contract_status(db, contract_id, locale)


@router.post("/webhook", status_code=204, summary="Signature-System signing callback")
async def contract_webhook(
    payload: ContractWebhookPayload,
    x_api_key: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Called by Signature-System when a contract's signing status changes.

    Makes "everyone signed -> the meeting is scheduled" immediate. Without it
    the same promotion still happens, just lazily, the next time either party
    reads their requests.

    The body is only a hint that something changed — the status is re-fetched
    from Signature-System rather than trusted from the payload, so a spoofed
    call can't mark an unsigned NDA as signed.
    """
    if not settings.NDA_SERVICE_KEY or x_api_key != settings.NDA_SERVICE_KEY:
        raise ForbiddenError(t("contracts", "errors.bad_webhook_key", DEFAULT_LOCALE))

    contract = await db.scalar(
        select(Contract).where(Contract.generated_pdf_key == str(payload.contract_id))
    )
    # 204 either way: a contract we don't know about is not Signature-System's
    # problem to retry, and returning an error would just make it keep trying.
    if contract is None or contract.meeting_request_id is None:
        return

    request = await db.get(MeetingRequest, contract.meeting_request_id)
    if request is not None:
        await meetings_service.refresh_request_state(db, request)
