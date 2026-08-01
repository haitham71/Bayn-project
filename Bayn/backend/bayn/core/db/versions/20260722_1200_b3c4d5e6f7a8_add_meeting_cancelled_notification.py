"""add meeting_cancelled to the notification type enum

Revision ID: b3c4d5e6f7a8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE can't run inside a transaction block, so use an
    # autocommit block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'meeting_cancelled'")


def downgrade() -> None:
    # PostgreSQL has no straightforward way to drop a single enum value.
    pass
