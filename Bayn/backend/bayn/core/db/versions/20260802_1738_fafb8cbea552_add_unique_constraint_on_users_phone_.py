"""add unique constraint on users phone_number

Revision ID: fafb8cbea552
Revises: ff30e9a53caa
Create Date: 2026-08-02 17:38:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fafb8cbea552'
down_revision: Union[str, None] = 'ff30e9a53caa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clear duplicates before adding the unique constraint, keeping the earliest account
    op.execute(
        """
        UPDATE users
        SET phone_number = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY phone_number
                           ORDER BY created_at ASC
                       ) AS rn
                FROM users
                WHERE phone_number IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.create_unique_constraint(
        "uq_users_phone_number", "users", ["phone_number"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_phone_number", "users", type_="unique")
