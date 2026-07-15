import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from bayn.core.database import Base

class ContractType(str, enum.Enum):
    nda = "nda"
    service_agreement = "service_agreement"

class ContractStatus(str, enum.Enum):
    pending_party_one = "pending_party_one"
    pending_party_two = "pending_party_two"
    signed = "signed"

class Contract(Base):
    """
    SQLAlchemy model representing the contracts table.
    Maintains relationships between meetings, projects, and users,
    along with signature tracking metadata synced from Signature-System.
    """
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_type = Column(Enum(ContractType), default=ContractType.nda, nullable=False)
    status = Column(Enum(ContractStatus), default=ContractStatus.pending_party_one, nullable=False)
    
    # Relations & Foreign Keys

    # The request this contract gates. This — not meeting_id — is what a
    # contract is created against, because the meeting doesn't exist yet.
    meeting_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("meeting_requests.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Null until both parties sign and the meeting is created from the request.
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    confidentiality_period_months = Column(Integer, default=12, nullable=True)

    # Party One Metadata (Typically the Requester)
    party_one_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    party_one_name = Column(String, nullable=False)
    party_one_national_id = Column(String, nullable=False)
    party_one_token = Column(String, unique=True, nullable=True)
    party_one_signature_image = Column(String, nullable=True)
    party_one_signed_pdf = Column(String, nullable=True)
    party_one_signed_at = Column(DateTime(timezone=True), nullable=True)
    party_one_signer_ip = Column(String, nullable=True)
    party_one_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Party Two Metadata (Typically the Owner)
    party_two_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    party_two_name = Column(String, nullable=False)
    party_two_national_id = Column(String, nullable=False)
    party_two_token = Column(String, unique=True, nullable=True)
    party_two_signature_image = Column(String, nullable=True)
    party_two_signed_at = Column(DateTime(timezone=True), nullable=True)
    party_two_signer_ip = Column(String, nullable=True)
    party_two_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # External reference identifier mapped to Signature-System contract ID
    generated_pdf_key = Column(String, nullable=True) 

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
