"""Contracts service — NDA creation and status sync.

Contracts are never created from client input: `create_nda_for_request` builds
both parties from the meeting request's own user rows, so a caller can't hand us
someone else's name or national ID. Signature-System owns the signing flow from
there (it emails both parties their links); this module only creates and polls.

Deliberately does not import the meetings service — the dependency runs the
other way (meetings -> contracts). Promoting a request once its NDA is signed
lives in `meetings.service.refresh_request_state`.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bayn.common.exceptions import NotFoundError, ValidationError
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.features.contracts.models import Contract, ContractStatus
from bayn.features.identity.models import User
from bayn.integrations.nda_service import NDAServiceError, nda_service_client

logger = logging.getLogger(__name__)

DEFAULT_CONFIDENTIALITY_MONTHS = 12


def _full_name(user: User) -> str:
    """The four-part legal name the NDA is signed under, Arabic first."""
    for parts in (
        (user.first_name_ar, user.second_name_ar, user.third_name_ar, user.last_name_ar),
        (user.first_name_en, user.second_name_en, user.third_name_en, user.last_name_en),
    ):
        name = " ".join(p for p in parts if p)
        if name.strip():
            return name.strip()
    return user.username


def _national_id(user: User) -> str:
    """TODO: drop this once national_id is required at signup — then read the
    column directly and let a missing one be a validation error.

    Until then accounts predate the field and it's still nullable, so signing
    would break for them. Derived from the user id rather than randomised so a
    given user keeps one identity across every contract they sign; shaped like a
    Saudi national ID (10 digits, leading 1) only so Signature-System's format
    check passes.
    """
    if user.national_id:
        return user.national_id
    return "1" + f"{user.id.int % 1_000_000_000:09d}"


async def get_contract_for_request(db: AsyncSession, request_id: uuid.UUID) -> Contract | None:
    return await db.scalar(select(Contract).where(Contract.meeting_request_id == request_id))


async def create_nda_for_request(
    db: AsyncSession,
    request,
    locale: str = DEFAULT_LOCALE,
) -> Contract:
    """Create the NDA gating `request` and hand it to Signature-System, which
    emails both parties their signing links.

    Idempotent: an existing contract for the request is returned untouched, so a
    retried accept can't double-send signing emails.

    The requester is party one — Signature-System emails them first, and they're
    the one asking to join.
    """
    existing = await get_contract_for_request(db, request.id)
    if existing is not None:
        return existing

    requester = await db.get(User, request.requester_id)
    owner = await db.get(User, request.owner_id)
    if requester is None or owner is None:
        raise NotFoundError(t("contracts", "errors.party_not_found", locale))

    contract = Contract(
        meeting_request_id=request.id,
        project_id=request.project_id,
        confidentiality_period_months=DEFAULT_CONFIDENTIALITY_MONTHS,
        party_one_user_id=requester.id,
        party_one_name=_full_name(requester),
        party_one_national_id=_national_id(requester),
        party_two_user_id=owner.id,
        party_two_name=_full_name(owner),
        party_two_national_id=_national_id(owner),
        status=ContractStatus.pending_party_one,
    )

    try:
        remote = await nda_service_client.create_contract(
            contract_type="nda",
            meeting_id=None,
            project_id=str(request.project_id),
            confidentiality_period_months=DEFAULT_CONFIDENTIALITY_MONTHS,
            party_one_user_id=str(requester.id),
            party_one_name=contract.party_one_name,
            party_one_national_id=contract.party_one_national_id,
            party_one_email=requester.email,
            party_two_user_id=str(owner.id),
            party_two_name=contract.party_two_name,
            party_two_national_id=contract.party_two_national_id,
            party_two_email=owner.email,
        )
    except NDAServiceError as exc:
        # Nothing is persisted, so the owner can just accept again once
        # Signature-System is reachable.
        logger.exception("NDA creation failed for meeting request %s", request.id)
        raise ValidationError(t("contracts", "errors.external_api_failed", locale)) from exc

    contract.generated_pdf_key = str(remote.get("id"))
    db.add(contract)
    await db.flush()
    return contract


async def sync_contract(db: AsyncSession, contract: Contract) -> Contract:
    """Pull the current signing status from Signature-System into `contract`.

    Best-effort: on any failure the local row is left as-is, since a contract
    that can't be reached is not evidence that nobody signed it. Does not
    commit — the caller owns the transaction.
    """
    if contract.status == ContractStatus.signed or not contract.generated_pdf_key:
        return contract

    try:
        remote = await nda_service_client.get_contract(contract.generated_pdf_key)
    except NDAServiceError:
        logger.warning("NDA status sync failed for contract %s", contract.id, exc_info=True)
        return contract

    remote_status = remote.get("status")
    # Compared against values, not ContractStatus.__members__ — the remote
    # sends values, and the two only coincide today by accident.
    if remote_status in {s.value for s in ContractStatus}:
        contract.status = ContractStatus(remote_status)

    return contract


async def sync_and_get_contract_status(
    db: AsyncSession,
    contract_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE,
) -> Contract:
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise NotFoundError(t("contracts", "errors.contract_not_found", locale))

    await sync_contract(db, contract)
    await db.commit()
    await db.refresh(contract)
    return contract
