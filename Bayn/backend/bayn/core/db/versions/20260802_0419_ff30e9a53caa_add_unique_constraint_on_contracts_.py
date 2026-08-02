"""add unique constraint on contracts meeting_request_id

Revision ID: ff30e9a53caa
Revises: 122faa838ce5
Create Date: 2026-08-02 04:19:57.852435

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'ff30e9a53caa'
down_revision: Union[str, None] = '122faa838ce5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove duplicates before adding the unique constraint
    op.execute(
        """
        UPDATE contracts
        SET meeting_request_id = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY meeting_request_id
                           ORDER BY created_at ASC
                       ) AS rn
                FROM contracts
                WHERE meeting_request_id IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.create_unique_constraint(
        "uq_contracts_meeting_request_id", "contracts", ["meeting_request_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_contracts_meeting_request_id", "contracts", type_="unique")
