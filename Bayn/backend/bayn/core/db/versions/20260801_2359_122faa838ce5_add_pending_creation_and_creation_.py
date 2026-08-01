"""add pending_creation and creation_failed to contractstatus

Revision ID: 122faa838ce5
Revises: a1b2c3d4e5f7
Create Date: 2026-08-01 23:59:08.694959

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '122faa838ce5'
down_revision: Union[str, None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
    # PG < 12; autocommit_block keeps this working on older servers too.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'pending_creation' BEFORE 'pending_party_one'")
        op.execute("ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'creation_failed' AFTER 'pending_creation'")


def downgrade() -> None:
    # Postgres has no DROP VALUE; rows already on the new statuses are moved
    # back to 'pending_party_one' so a rebuild-free downgrade doesn't leave
    # an unknown value.
    op.execute(
        "UPDATE contracts SET status = 'pending_party_one' "
        "WHERE status IN ('pending_creation', 'creation_failed')"
    )
