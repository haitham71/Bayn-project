"""add bio to users

Revision ID: c48a1e9d2b7f
Revises: fb0bf10dd309
Create Date: 2026-07-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c48a1e9d2b7f'
down_revision: Union[str, None] = 'fb0bf10dd309'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('bio', sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'bio')
