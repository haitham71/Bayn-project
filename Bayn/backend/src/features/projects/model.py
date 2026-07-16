"""project.py
This module contains the SQLAlchemy models for the project management feature of the application."""
import uuid
import enum
from typing import List, Optional
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func, Enum, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


class userRoleProject(str, enum.Enum):
    MEMBER = "member"
    OWNER = "owner"

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    more_info: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    specialization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("specializations.id"), nullable=True)
    industry_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True)
    availability: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    project_url: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    images: Mapped[List[str]] = mapped_column(ARRAY(String(200)), nullable=True)
    # calendar_slots: Mapped[List["CalendarSlot"]] = relationship("CalendarSlot", back_populates="project", cascade="all, delete-orphan")
    # False = user-suggested, hidden from search until an admin approves it
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    # user_skills: Mapped[list["UserSkill"]] = relationship("UserSkill", back_populates="skill", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Project {self.title}>"


class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    role: Mapped[userRoleProject] = mapped_column(Enum(userRoleProject, values_callable=lambda x: [e.value for e in x]), default=userRoleProject.MEMBER, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


    def __repr__(self) -> str:
        return f"<ProjectMembership user_id={self.user_id} project_id={self.project_id} role={self.role}>"
    