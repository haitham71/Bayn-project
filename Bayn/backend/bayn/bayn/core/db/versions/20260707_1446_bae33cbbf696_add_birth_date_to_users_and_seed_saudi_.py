"""add birth_date to users and seed saudi country

Revision ID: bae33cbbf696
Revises: 4317335417d8
Create Date: 2026-07-07 14:46:25.053874

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bae33cbbf696'
down_revision: Union[str, None] = '4317335417d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # birth_date was added to the User model but never migrated.
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))

    # Seed Saudi Arabia so phone_country_id resolves for +966 numbers.
    # Idempotent: does nothing if the row already exists.
    op.execute(
        """
        INSERT INTO countries (id, name_en, name_ar, iso2, dial_code, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Saudi Arabia', 'المملكة العربية السعودية', 'SA', '+966', now(), now())
        ON CONFLICT (iso2) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM countries WHERE iso2 = 'SA'")
    op.drop_column("users", "birth_date")
