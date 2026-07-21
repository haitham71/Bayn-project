"""replace tasks.assigned_to with a task_assignees join table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'task_assignees',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'user_id', name='uq_task_assignee'),
    )

    # carry over each task's single assignee as its first row in the new table
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO task_assignees (id, task_id, user_id, created_at) "
        "SELECT gen_random_uuid(), id, assigned_to, now() FROM tasks WHERE assigned_to IS NOT NULL"
    ))

    op.drop_constraint('tasks_assigned_to_fkey', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'assigned_to')


def downgrade() -> None:
    op.add_column('tasks', sa.Column('assigned_to', sa.UUID(), nullable=True))
    op.create_foreign_key('tasks_assigned_to_fkey', 'tasks', 'users', ['assigned_to'], ['id'])

    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE tasks SET assigned_to = ta.user_id FROM ("
        "  SELECT DISTINCT ON (task_id) task_id, user_id FROM task_assignees ORDER BY task_id, created_at"
        ") ta WHERE ta.task_id = tasks.id"
    ))

    op.drop_table('task_assignees')
