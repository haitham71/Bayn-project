import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from bayn.core.i18n import DEFAULT_LOCALE, t
from bayn.common.exceptions import ValidationError, NotFoundError
from bayn.features.contracts.models import Contract, ContractStatus
from bayn.features.contracts.schemas import ContractCreateRequest
from bayn.integrations.nda_service import nda_service_client

async def initiate_nda_contract(
    db: AsyncSession, 
    payload: ContractCreateRequest, 
    current_user_id: uuid.UUID,
    locale: str = DEFAULT_LOCALE
) -> Contract:
    """
    Creates a localized contract row locally and forwards registration parameters 
    to the external Signature-System microservice client.
    """
    # 1. Dispatch request payload to the external Signature-System API client
    try:
        remote_contract = await nda_service_client.create_contract(
            contract_type="nda",
            meeting_id=str(payload.meeting_id),
            project_id=str(payload.project_id) if payload.project_id else None,
            confidentiality_period_months=payload.confidentiality_period_months,
            party_one_user_id=str(current_user_id),
            party_one_name=payload.party_one_name,
            party_one_national_id=payload.party_one_national_id,
            party_one_email=payload.party_one_email,
            party_two_user_id=str(payload.party_two_user_id),
            party_two_name=payload.party_two_name,
            party_two_national_id=payload.party_two_national_id,
            party_two_email=payload.party_two_email
        )
    except Exception as e:
        # Translates external communication failures via translation keys
        raise ValidationError(t("contracts", "errors.external_api_failed", locale))

    signature_system_id = remote_contract.get("id")

    # 2. Persist tracking parameters into the local database instance
    new_contract = Contract(
        meeting_id=payload.meeting_id,
        project_id=payload.project_id,
        confidentiality_period_months=payload.confidentiality_period_months,
        party_one_user_id=current_user_id,
        party_one_name=payload.party_one_name,
        party_one_national_id=payload.party_one_national_id,
        party_two_user_id=payload.party_two_user_id,
        party_two_name=payload.party_two_name,
        party_two_national_id=payload.party_two_national_id,
        generated_pdf_key=str(signature_system_id),
        status=ContractStatus.pending_party_one
    )

    db.add(new_contract)
    await db.commit()
    await db.refresh(new_contract)
    
    return new_contract

async def sync_and_get_contract_status(
    db: AsyncSession, 
    contract_id: uuid.UUID, 
    locale: str = DEFAULT_LOCALE
) -> Contract:
    """
    Polls the Signature-System context for real-time validation tracking,
    updating local records seamlessly if transitions are caught.
    """
    query = select(Contract).where(Contract.id == contract_id)
    contract = (await db.execute(query)).scalar_one_or_none()
    
    if not contract:
        raise NotFoundError(t("contracts", "errors.contract_not_found", locale))

    # Skip external network traffic if local contract status is resolved to signed
    if contract.status == ContractStatus.signed:
        return contract

    try:
        # Re-fetch structural states via signature client polling hooks
        remote_data = await nda_service_client.get_contract(contract.generated_pdf_key)
        remote_status = remote_data.get("status")
        
        # Sync changes if signature status updates match validation parameters
        if remote_status in ContractStatus.__members__:
            contract.status = ContractStatus(remote_status)
            await db.commit()
            await db.refresh(contract)
            
    except Exception:
        # Fall back to localized cache parameters if backend service fails intermittently
        pass

    return contract
