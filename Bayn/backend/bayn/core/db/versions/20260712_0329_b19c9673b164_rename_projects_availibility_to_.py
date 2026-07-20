"""rename projects availibility to availability

Revision ID: b19c9673b164
Revises: a8e21f6c9d34
Create Date: 2026-07-12 03:29:56.140518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b19c9673b164'
down_revision: Union[str, None] = 'a8e21f6c9d34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('projects', 'availibility', new_column_name='availability')


def downgrade() -> None:
    op.alter_column('projects', 'availability', new_column_name='availibility')
