"""add meeting_title to meeting_requests

Revision ID: 9a32c90752e9
Revises: 43a2ef71f540
Create Date: 2026-07-18 18:07:08.587634

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a32c90752e9'
down_revision: Union[str, None] = '43a2ef71f540'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meeting_requests", sa.Column("meeting_title", sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column("meeting_requests", "meeting_title")
