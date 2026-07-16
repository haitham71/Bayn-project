"""add project meeting slots and meeting request slot_id

Revision ID: c9a1f2b3d4e5
Revises: b19c9673b164
Create Date: 2026-07-15 07:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c9a1f2b3d4e5'
down_revision: Union[str, None] = 'b19c9673b164'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    slot_status = postgresql.ENUM('available', 'taken', name='slotstatus')
    slot_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'project_meeting_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM('available', 'taken', name='slotstatus', create_type=False),
            server_default='available',
            nullable=False,
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.add_column('meeting_requests', sa.Column('slot_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_meeting_requests_slot_id',
        'meeting_requests',
        'project_meeting_slots',
        ['slot_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_meeting_requests_slot_id', 'meeting_requests', type_='foreignkey')
    op.drop_column('meeting_requests', 'slot_id')
    op.drop_table('project_meeting_slots')
    postgresql.ENUM(name='slotstatus').drop(op.get_bind(), checkfirst=True)
