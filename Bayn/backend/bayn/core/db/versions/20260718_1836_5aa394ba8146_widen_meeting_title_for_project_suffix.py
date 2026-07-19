"""widen meeting title for project suffix

Revision ID: 5aa394ba8146
Revises: 9a32c90752e9
Create Date: 2026-07-18 18:36:16.211313

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5aa394ba8146'
down_revision: Union[str, None] = '9a32c90752e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("meetings", "title", type_=sa.String(length=420), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("meetings", "title", type_=sa.String(length=200), existing_nullable=True)
