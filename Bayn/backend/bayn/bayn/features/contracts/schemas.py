import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from bayn.features.contracts.models import ContractType, ContractStatus

class ContractCreateRequest(BaseModel):
    """API request payload schema for initiating an NDA contract."""
    meeting_id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    confidentiality_period_months: int = Field(default=12, ge=1)
    
    # Party One Data Input (Sender/Requester)
    party_one_name: str
    party_one_national_id: str
    party_one_email: EmailStr
    
    # Party Two Data Input (Receiver/Owner)
    party_two_user_id: uuid.UUID
    party_two_name: str
    party_two_national_id: str
    party_two_email: EmailStr

class ContractResponse(BaseModel):
    """API response shape exposing contract metadata to the UI without sensitive inner fields."""
    id: uuid.UUID
    contract_type: ContractType
    status: ContractStatus
    meeting_id: uuid.UUID
    project_id: Optional[uuid.UUID]
    generated_pdf_key: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
