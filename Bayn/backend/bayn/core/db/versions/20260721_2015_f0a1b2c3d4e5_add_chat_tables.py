"""add chat tables (conversations, members, messages)

The chat models shipped with ALTER migrations (add_last_read_at, add_message_
mentions) but no CREATE migration for the core tables, so a fresh database
couldn't upgrade. This creates them, chained in right before add_last_read_at.
The conversations table carries an optional project_id for team group chats.

Revision ID: f0a1b2c3d4e5
Revises: a7b8c9d0e1f2
Create Date: 2026-07-21 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=True),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # last_read_at is added by the next migration (b8c9d0e1f2a3), so it's left
    # out here to keep the historical sequence intact.
    op.create_table(
        'conversation_members',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_user'),
    )
    op.create_table(
        'messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.String(length=2000), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('messages')
    op.drop_table('conversation_members')
    op.drop_table('conversations')
