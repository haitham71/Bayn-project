"""add missing password reset/change columns to users

Revision ID: 9c55f9f74c25
Revises: 00a5cb1fce96
Create Date: 2026-07-11 00:06:20.136834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c55f9f74c25'
down_revision: Union[str, None] = '00a5cb1fce96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    password_action_type = sa.Enum('RESET', 'CHANGE', name='passwordactiontype')
    password_action_type.create(op.get_bind(), checkfirst=True)

    op.add_column('users', sa.Column('password_action_token_hash', sa.String(), nullable=True))
    op.add_column('users', sa.Column('password_action_type', password_action_type, nullable=True))
    op.add_column('users', sa.Column('password_action_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('pending_password_hash', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'pending_password_hash')
    op.drop_column('users', 'password_action_expires_at')
    op.drop_column('users', 'password_action_type')
    op.drop_column('users', 'password_action_token_hash')
    sa.Enum(name='passwordactiontype').drop(op.get_bind(), checkfirst=True)
