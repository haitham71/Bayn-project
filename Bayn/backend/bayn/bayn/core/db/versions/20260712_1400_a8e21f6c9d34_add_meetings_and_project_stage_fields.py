"""add meetings feature tables and project stage/team_members_needed

Revision ID: a8e21f6c9d34
Revises: d91f3a5c6e02
Create Date: 2026-07-12 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8e21f6c9d34'
down_revision: Union[str, None] = 'd91f3a5c6e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    project_stage = sa.Enum('planning', 'development', 'launching', name='projectstage')
    project_stage.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'projects',
        sa.Column('stage', project_stage, nullable=False, server_default='planning'),
    )
    op.add_column(
        'projects',
        sa.Column('team_members_needed', sa.Integer(), nullable=False, server_default='1'),
    )
    op.create_check_constraint(
        'ck_project_team_members_needed_range',
        'projects',
        'team_members_needed BETWEEN 1 AND 12',
    )

    meeting_request_status = sa.Enum(
        'pending', 'accepted', 'rejected', 'cancelled', 'expired', name='meetingrequeststatus'
    )
    meeting_request_status.create(op.get_bind(), checkfirst=True)
    attendance_status = sa.Enum('present', 'absent', 'late', name='attendancestatus')
    attendance_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'meetings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('counterpart_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_initial_meeting', sa.Boolean(), nullable=False),
        sa.Column('calcom_booking_id', sa.String(length=255), nullable=True),
        sa.Column('video_link', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['counterpart_id'], ['users.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # the earlier "add contracts table with meetings" migration was left as a
    # no-op stub, so the contracts table has never actually been created
    contract_type = sa.Enum('nda', 'service_agreement', name='contracttype')
    contract_type.create(op.get_bind(), checkfirst=True)
    contract_status = sa.Enum('pending_party_one', 'pending_party_two', 'signed', name='contractstatus')
    contract_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'contracts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contract_type', contract_type, nullable=False, server_default='nda'),
        sa.Column('status', contract_status, nullable=False, server_default='pending_party_one'),
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('confidentiality_period_months', sa.Integer(), nullable=True, server_default='12'),
        sa.Column('party_one_user_id', sa.UUID(), nullable=False),
        sa.Column('party_one_name', sa.String(), nullable=False),
        sa.Column('party_one_national_id', sa.String(), nullable=False),
        sa.Column('party_one_token', sa.String(), nullable=True),
        sa.Column('party_one_signature_image', sa.String(), nullable=True),
        sa.Column('party_one_signed_pdf', sa.String(), nullable=True),
        sa.Column('party_one_signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('party_one_signer_ip', sa.String(), nullable=True),
        sa.Column('party_one_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('party_two_user_id', sa.UUID(), nullable=False),
        sa.Column('party_two_name', sa.String(), nullable=False),
        sa.Column('party_two_national_id', sa.String(), nullable=False),
        sa.Column('party_two_token', sa.String(), nullable=True),
        sa.Column('party_two_signature_image', sa.String(), nullable=True),
        sa.Column('party_two_signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('party_two_signer_ip', sa.String(), nullable=True),
        sa.Column('party_two_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('generated_pdf_key', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['party_one_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['party_two_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('party_one_token'),
        sa.UniqueConstraint('party_two_token'),
    )

    op.create_table(
        'meeting_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('requester_id', sa.UUID(), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('proposed_start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('proposed_end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('message', sa.String(length=500), nullable=True),
        sa.Column('status', meeting_request_status, nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resulting_meeting_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id']),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['resulting_meeting_id'], ['meetings.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'meeting_attendances',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('membership_id', sa.UUID(), nullable=False),
        sa.Column('status', attendance_status, nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['meetings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['membership_id'], ['project_memberships.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('meeting_attendances')
    op.drop_table('meeting_requests')
    op.drop_table('contracts')
    op.drop_table('meetings')

    op.drop_constraint('ck_project_team_members_needed_range', 'projects', type_='check')
    op.drop_column('projects', 'team_members_needed')
    op.drop_column('projects', 'stage')

    sa.Enum(name='attendancestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='meetingrequeststatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='contractstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='contracttype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='projectstage').drop(op.get_bind(), checkfirst=True)
