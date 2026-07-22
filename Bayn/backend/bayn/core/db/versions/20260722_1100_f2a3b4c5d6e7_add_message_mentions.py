"""add message_mentions table

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'message_mentions',
        sa.Column('message_id', sa.UUID(), nullable=False),
        sa.Column('mentioned_user_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mentioned_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('message_id', 'mentioned_user_id'),
    )


def downgrade() -> None:
    op.drop_table('message_mentions')
