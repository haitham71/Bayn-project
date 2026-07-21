"""add meeting_participants table and meetings.slot_id

Revision ID: a1b2c3d4e5f6
Revises: 5aa394ba8146
Create Date: 2026-07-19 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5aa394ba8146'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The slot a meeting was booked on — same-slot join requests fold into one
    # shared meeting instead of one per applicant.
    op.add_column('meetings', sa.Column('slot_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_meetings_slot_id',
        'meetings',
        'project_meeting_slots',
        ['slot_id'],
        ['id'],
    )

    # Unified attendee list, so a meeting can hold more than the original
    # user_id/counterpart_id pair (team meetings, same-slot applicant meetings).
    op.create_table(
        'meeting_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('meeting_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_host', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('meeting_id', 'user_id', name='uq_meeting_participant'),
    )


def downgrade() -> None:
    op.drop_table('meeting_participants')
    op.drop_constraint('fk_meetings_slot_id', 'meetings', type_='foreignkey')
    op.drop_column('meetings', 'slot_id')
