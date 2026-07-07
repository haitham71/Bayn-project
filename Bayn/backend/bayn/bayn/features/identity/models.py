"""Identity models: User, Country, AuthenticaOTPLog."""

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


# member name == value (both lowercase) so Postgres stores "user"/"admin";
# without this SQLAlchemy sends the member NAME and the enum insert fails
class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class OTPChannel(str, enum.Enum):
    email = "email"
    sms = "sms"


class OTPStatus(str, enum.Enum):
    sent = "sent"
    verified = "verified"
    expired = "expired"


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ar: Mapped[str] = mapped_column(String(100), nullable=False)
    iso2: Mapped[str] = mapped_column(String(2), unique=True, nullable=False)
    dial_code: Mapped[str] = mapped_column(String(10), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # foreign_keys is explicit because User could gain other FKs to countries later
    users: Mapped[list["User"]] = relationship(
        "User", back_populates="phone_country", foreign_keys="User.phone_country_id"
    )

    def __repr__(self) -> str:
        return f"<Country {self.iso2} - {self.name_en}>"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # four-part name in Arabic and English (national ID requires the full name)
    first_name_ar: Mapped[str] = mapped_column(String(50), nullable=False)
    second_name_ar: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    third_name_ar: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name_ar: Mapped[str] = mapped_column(String(50), nullable=False)

    first_name_en: Mapped[str] = mapped_column(String(50), nullable=False)
    second_name_en: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    third_name_en: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_name_en: Mapped[str] = mapped_column(String(50), nullable=False)

    national_id: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    phone_country_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("countries.id"), nullable=True
    )
    # local number without the dial code, e.g. 501234567
    phone_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    industry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True
    )

    # values_callable makes SQLAlchemy store enum values ("user") not names
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x]),
        default=UserRole.user,
        nullable=False,
    )

    # R2 object key like "avatars/uuid.jpg", not a full URL
    avatar_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    git_profile: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    calcom_user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    calcom_access_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    calcom_refresh_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_number_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # soft delete: non-null means deleted, row is retained for audit
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    phone_country: Mapped[Optional["Country"]] = relationship(
        "Country", back_populates="users", foreign_keys=[phone_country_id]
    )
    otp_logs: Mapped[list["AuthenticaOTPLog"]] = relationship(
        "AuthenticaOTPLog", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.email})>"


class AuthenticaOTPLog(Base):
    __tablename__ = "authentica_otp_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    channel: Mapped[OTPChannel] = mapped_column(
        Enum(OTPChannel, values_callable=lambda x: [e.value for e in x]), nullable=False
    )
    # always "n/a" — Authentica v2 returns no reference id
    reference_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[OTPStatus] = mapped_column(
        Enum(OTPStatus, values_callable=lambda x: [e.value for e in x]),
        default=OTPStatus.sent,
        nullable=False,
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="otp_logs")

    def __repr__(self) -> str:
        return f"<OTPLog user={self.user_id} channel={self.channel} status={self.status}>"
