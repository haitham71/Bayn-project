"""add terms_accepted_at to users

The signup flow now requires accepting the terms (UserSignup.terms_accepted),
and the User model records when it happened via terms_accepted_at. This adds
the backing column the model expects.

Revision ID: e5f6a7b8c9d0
Revises: c1d2e3f4a5b6
Create Date: 2026-07-21 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOT NULL with a server default so existing rows get a timestamp.
    op.add_column(
        'users',
        sa.Column('terms_accepted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column('users', 'terms_accepted_at')
