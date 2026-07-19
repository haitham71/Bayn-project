"""gate meetings behind signed contracts

Splits accept-a-slot from schedule-a-meeting: the contract is now created when
the owner accepts, which is *before* any meeting exists, so contracts.meeting_id
can no longer be required. It stays for backfilled rows and is set once the
meeting is finally created; meeting_request_id is what the contract is created
against.

Revision ID: e4c7a2b8f610
Revises: c9a1f2b3d4e5
Create Date: 2026-07-15 11:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4c7a2b8f610'
down_revision: Union[str, None] = 'c9a1f2b3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Postgres has no DROP VALUE, so downgrade() can't remove these — see below.
NEW_REQUEST_STATUSES = ('awaiting_signatures', 'scheduled', 'approved', 'declined')


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
    # PG < 12; autocommit_block keeps this working on older servers too.
    with op.get_context().autocommit_block():
        for value in NEW_REQUEST_STATUSES:
            op.execute(f"ALTER TYPE meetingrequeststatus ADD VALUE IF NOT EXISTS '{value}'")

    op.alter_column('contracts', 'meeting_id', existing_type=sa.UUID(), nullable=True)

    op.add_column('contracts', sa.Column('meeting_request_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_contracts_meeting_request_id',
        'contracts',
        'meeting_requests',
        ['meeting_request_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_contracts_meeting_request_id', 'contracts', ['meeting_request_id'])

    # Set when the owner makes the post-meeting call, so a decision can be
    # distinguished from a request that simply hasn't reached one yet.
    op.add_column('meeting_requests', sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('meeting_requests', 'decided_at')
    op.drop_index('ix_contracts_meeting_request_id', table_name='contracts')
    op.drop_constraint('fk_contracts_meeting_request_id', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'meeting_request_id')

    # Rows created under the new flow have no meeting until both parties sign,
    # so restoring NOT NULL would fail on them. They're deleted rather than
    # silently dropped from the constraint.
    op.execute("DELETE FROM contracts WHERE meeting_id IS NULL")
    op.alter_column('contracts', 'meeting_id', existing_type=sa.UUID(), nullable=False)

    # The four added enum values are intentionally left in place: Postgres
    # cannot drop them, and rebuilding the type would need every dependent
    # column rewritten. Rows still holding them are moved back to a status the
    # old code understands.
    op.execute("UPDATE meeting_requests SET status = 'pending' WHERE status = 'awaiting_signatures'")
    op.execute("UPDATE meeting_requests SET status = 'accepted' WHERE status IN ('scheduled', 'approved')")
    op.execute("UPDATE meeting_requests SET status = 'rejected' WHERE status = 'declined'")
