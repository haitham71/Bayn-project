"""add last_read_at to conversation_members

Revision ID: b8c9d0e1f2a3
Revises: f0a1b2c3d4e5
Create Date: 2026-07-21 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'f0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversation_members', sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('conversation_members', 'last_read_at')
