from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from bayn.core.database import get_db
from bayn.core.i18n import get_locale
from bayn.features.identity.dependencies import get_current_active_user
from bayn.features.identity.models import User
from bayn.features.contracts.schemas import ContractCreateRequest, ContractResponse
from bayn.features.contracts import service

router = APIRouter(prefix="/v1/contracts", tags=["Contracts"])

@router.post(
    "", 
    response_model=ContractResponse, 
    status_code=201, 
    summary="Initiate a new NDA contract and send signing links"
)
async def create_nda_contract(
    payload: ContractCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    locale: str = Depends(get_locale)
) -> ContractResponse:
    """Trigger contract building endpoints and register data context."""
    return await service.initiate_nda_contract(
        db=db, 
        payload=payload, 
        current_user_id=current_user.id, 
        locale=locale
    )

@router.get(
    "/{contract_id}/status", 
    response_model=ContractResponse, 
    summary="Fetch current contract configuration status via server polling"
)
async def get_contract_status(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    locale: str = Depends(get_locale)
) -> ContractResponse:
    """Sync dynamic execution patterns and return structural responses."""
    return await service.sync_and_get_contract_status(
        db=db, 
        contract_id=contract_id, 
        locale=locale
    )
