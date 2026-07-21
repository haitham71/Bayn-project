"""Projects models: projects and their memberships."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Enum, ForeignKey, Integer, String, Table, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from bayn.core.database import Base


# Skills the owner wants for a project — surfaced to users as "required skills".
# A plain association table: no extra columns, the (project, skill) pair is the row.
project_skills = Table(
    "project_skills",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)


class ProjectMembershipRole(str, enum.Enum):
    """
    OWNER   = created the project, full control.
    MEMBER  = joined an existing project (a user may hold at most 2 memberships total).
    """
    OWNER = "owner"
    MEMBER = "member"


class ProjectStage(str, enum.Enum):
    idea = "idea"
    planning = "planning"
    development = "development"
    launching = "launching"


class SlotStatus(str, enum.Enum):
    available = "available"
    taken = "taken"


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

    industry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True
    )

    # when the owner is next available to meet about this project
    availability: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # hidden projects are excluded from public listings but still directly accessible by id
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    memberships: Mapped[list["ProjectMembership"]] = relationship(
        "ProjectMembership", back_populates="project", cascade="all, delete-orphan"
    )
    meeting_slots: Mapped[list["ProjectMeetingSlot"]] = relationship(
        "ProjectMeetingSlot", back_populates="project", cascade="all, delete-orphan"
    )
    # selectin: skills load automatically on every project read, so responses can
    # include them without each query having to ask.
    skills: Mapped[list["Skill"]] = relationship(
        "Skill", secondary=project_skills, lazy="selectin", order_by="Skill.name"
    )
    # One row per open team seat — team_members_needed is just len(team_slots).
    team_slots: Mapped[list["ProjectTeamSlot"]] = relationship(
        "ProjectTeamSlot", cascade="all, delete-orphan", lazy="selectin", order_by="ProjectTeamSlot.created_at"
    )

    def __repr__(self) -> str:
        return f"<Project {self.title}>"


class ProjectTeamSlot(Base):
    """One open seat on the project's team, described by the specialization(s)
    that would fill it. `alternate_specialization_id` lets a seat accept
    either of two specializations (e.g. "backend OR full-stack").

    The service layer enforces one slot per seat: len(project.team_slots)
    must equal project.team_members_needed."""
    __tablename__ = "project_team_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    specialization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("specializations.id"), nullable=False
    )
    alternate_specialization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("specializations.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectTeamSlot project={self.project_id} spec={self.specialization_id}>"


class ProjectMeetingSlot(Base):
    """A time window the owner offers for a first meeting. A joiner picks one
    when requesting to join; on approval the slot is marked taken."""
    __tablename__ = "project_meeting_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[SlotStatus] = mapped_column(
        Enum(SlotStatus, values_callable=lambda x: [e.value for e in x]),
        default=SlotStatus.available,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped["Project"] = relationship("Project", back_populates="meeting_slots")

    def __repr__(self) -> str:
        return f"<ProjectMeetingSlot project={self.project_id} {self.start_time} ({self.status})>"


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
