"""add country city_id job_title to users, add cities table

Revision ID: 2f186ba6d99f
Revises: bae33cbbf696
Create Date: 2026-07-10 23:44:10.525986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision: str = '2f186ba6d99f'
down_revision: Union[str, None] = 'bae33cbbf696'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name_en, name_ar) — major Saudi cities, seeded against the SA country row
SAUDI_CITIES = [
    ("Riyadh", "الرياض"),
    ("Jeddah", "جدة"),
    ("Mecca", "مكة المكرمة"),
    ("Medina", "المدينة المنورة"),
    ("Dammam", "الدمام"),
    ("Khobar", "الخبر"),
    ("Dhahran", "الظهران"),
    ("Taif", "الطائف"),
    ("Buraidah", "بريدة"),
    ("Tabuk", "تبوك"),
    ("Abha", "أبها"),
    ("Khamis Mushait", "خميس مشيط"),
    ("Najran", "نجران"),
    ("Jazan", "جازان"),
    ("Hail", "حائل"),
    ("Yanbu", "ينبع"),
    ("Al-Ahsa", "الأحساء"),
    ("Qatif", "القطيف"),
    ("Jubail", "الجبيل"),
    ("Arar", "عرعر"),
]


def upgrade() -> None:
    op.create_table(
        'cities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('country_id', sa.UUID(), nullable=False),
        sa.Column('name_en', sa.String(length=100), nullable=False),
        sa.Column('name_ar', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['country_id'], ['countries.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.add_column('users', sa.Column('country_id', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('city_id', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('job_title', sa.String(length=150), nullable=True))
    op.create_foreign_key('users_country_id_fkey', 'users', 'countries', ['country_id'], ['id'])
    op.create_foreign_key('users_city_id_fkey', 'users', 'cities', ['city_id'], ['id'])
    op.drop_column('users', 'city')

    # seed major Saudi cities against the SA row seeded in the previous migration
    conn = op.get_bind()
    saudi_id = conn.execute(sa.text("SELECT id FROM countries WHERE iso2 = 'SA'")).scalar()
    if saudi_id is not None:
        conn.execute(
            sa.text(
                "INSERT INTO cities (id, country_id, name_en, name_ar, created_at, updated_at) "
                "VALUES (:id, :country_id, :name_en, :name_ar, now(), now())"
            ),
            [
                {"id": str(uuid.uuid4()), "country_id": str(saudi_id), "name_en": name_en, "name_ar": name_ar}
                for name_en, name_ar in SAUDI_CITIES
            ],
        )


def downgrade() -> None:
    op.add_column('users', sa.Column('city', sa.String(length=100), nullable=True))
    op.drop_constraint('users_city_id_fkey', 'users', type_='foreignkey')
    op.drop_constraint('users_country_id_fkey', 'users', type_='foreignkey')
    op.drop_column('users', 'job_title')
    op.drop_column('users', 'city_id')
    op.drop_column('users', 'country_id')
    op.drop_table('cities')
