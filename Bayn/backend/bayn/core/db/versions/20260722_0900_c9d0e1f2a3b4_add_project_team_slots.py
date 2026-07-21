"""replace projects.specialization_id with per-seat project_team_slots

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_team_slots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('specialization_id', sa.UUID(), nullable=False),
        sa.Column('alternate_specialization_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['specialization_id'], ['specializations.id']),
        sa.ForeignKeyConstraint(['alternate_specialization_id'], ['specializations.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # existing projects' single specialization becomes their first (and only) seat
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO project_team_slots (id, project_id, specialization_id, created_at) "
        "SELECT gen_random_uuid(), id, specialization_id, now() FROM projects WHERE specialization_id IS NOT NULL"
    ))

    op.drop_constraint('projects_specialization_id_fkey', 'projects', type_='foreignkey')
    op.drop_column('projects', 'specialization_id')


def downgrade() -> None:
    op.add_column('projects', sa.Column('specialization_id', sa.UUID(), nullable=True))
    op.create_foreign_key('projects_specialization_id_fkey', 'projects', 'specializations', ['specialization_id'], ['id'])

    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE projects SET specialization_id = slot.specialization_id FROM ("
        "  SELECT DISTINCT ON (project_id) project_id, specialization_id "
        "  FROM project_team_slots ORDER BY project_id, created_at"
        ") slot WHERE slot.project_id = projects.id"
    ))

    op.drop_table('project_team_slots')
