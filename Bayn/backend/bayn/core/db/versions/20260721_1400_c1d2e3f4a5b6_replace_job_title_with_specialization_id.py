"""replace job_title with specialization_id on users

Revision ID: c1d2e3f4a5b6
Revises: b7c8d9e0f1a2
Create Date: 2026-07-21 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('specialization_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'users_specialization_id_fkey', 'users', 'specializations', ['specialization_id'], ['id']
    )
    op.drop_column('users', 'job_title')


def downgrade() -> None:
    op.add_column('users', sa.Column('job_title', sa.String(length=150), nullable=True))
    op.drop_constraint('users_specialization_id_fkey', 'users', type_='foreignkey')
    op.drop_column('users', 'specialization_id')
