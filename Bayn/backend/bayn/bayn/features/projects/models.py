"""Projects models: projects and their memberships."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


class ProjectMembershipRole(str, enum.Enum):
    """
    OWNER   = created the project, full control.
    MEMBER  = joined an existing project (a user may hold at most 2 memberships total).
    """
    OWNER = "owner"
    MEMBER = "member"


class ProjectStage(str, enum.Enum):
    planning = "planning"
    development = "development"
    launching = "launching"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("team_members_needed BETWEEN 1 AND 12", name="ck_project_team_members_needed_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    more_info: Mapped[str | None] = mapped_column(Text, nullable=True)

    stage: Mapped[ProjectStage] = mapped_column(
        Enum(ProjectStage, values_callable=lambda x: [e.value for e in x]),
        default=ProjectStage.planning,
        nullable=False,
    )
    team_members_needed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    specialization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("specializations.id"), nullable=True
    )
    industry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True
    )

    # when the owner is next available to meet about this project
    availibility: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # hidden projects are excluded from public listings but still directly accessible by id
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    memberships: Mapped[list["ProjectMembership"]] = relationship(
        "ProjectMembership", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project {self.title}>"


class ProjectMembership(Base):
    __tablename__ = "project_memberships"
    # a user can only hold one membership row per project (their role can't be ambiguous)
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_project_membership"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    role: Mapped[ProjectMembershipRole] = mapped_column(Enum(ProjectMembershipRole), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    project: Mapped["Project"] = relationship("Project", back_populates="memberships")

    def __repr__(self) -> str:
        return f"<ProjectMembership user={self.user_id} project={self.project_id} role={self.role}>"
