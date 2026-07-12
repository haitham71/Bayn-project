"""add years_of_experience to users

Revision ID: 00a5cb1fce96
Revises: 2f186ba6d99f
Create Date: 2026-07-11 00:02:28.550683

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00a5cb1fce96'
down_revision: Union[str, None] = '2f186ba6d99f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    experience_range = sa.Enum(
        'less_than_1', '1-2', '2-3', '3-4', '5-10', '10+', name='experiencerange'
    )
    experience_range.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'users',
        sa.Column('years_of_experience', experience_range, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'years_of_experience')
    sa.Enum(name='experiencerange').drop(op.get_bind(), checkfirst=True)
