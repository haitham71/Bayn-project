"""add room_name and recording_key to meetings

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-22 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('room_name', sa.String(length=255), nullable=True))
    op.add_column('meetings', sa.Column('recording_key', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'recording_key')
    op.drop_column('meetings', 'room_name')
