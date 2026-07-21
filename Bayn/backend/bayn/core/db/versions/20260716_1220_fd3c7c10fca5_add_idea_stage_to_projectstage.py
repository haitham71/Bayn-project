"""add idea stage to projectstage enum

Revision ID: fd3c7c10fca5
Revises: 2623d0c33a1a
Create Date: 2026-07-16 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fd3c7c10fca5'
down_revision: Union[str, None] = '2623d0c33a1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
    # PG < 12; autocommit_block keeps this working on older servers too.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE projectstage ADD VALUE IF NOT EXISTS 'idea' BEFORE 'planning'")


def downgrade() -> None:
    # Postgres has no DROP VALUE; rows already on 'idea' are moved back to
    # 'planning' so a rebuild-free downgrade doesn't leave an unknown value.
    op.execute("UPDATE projects SET stage = 'planning' WHERE stage = 'idea'")
