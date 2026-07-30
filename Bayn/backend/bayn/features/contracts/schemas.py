import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from bayn.features.contracts.models import ContractType, ContractStatus


class ContractWebhookPayload(BaseModel):
    """Signature-System's signing callback.

    `contract_id` is *its* id for the contract (what we store in
    generated_pdf_key), not ours. Any status it sends is ignored — the real one
    is re-fetched — so this is a nudge, not a source of truth.
    """
    contract_id: str


class ContractResponse(BaseModel):
    """API response shape exposing contract metadata to the UI without sensitive inner fields."""
    id: uuid.UUID
    contract_type: ContractType
    status: ContractStatus
    meeting_request_id: Optional[uuid.UUID]
    meeting_id: Optional[uuid.UUID]
    project_id: Optional[uuid.UUID]
    idae_title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
