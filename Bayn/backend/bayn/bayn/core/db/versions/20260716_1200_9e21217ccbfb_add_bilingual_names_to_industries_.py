"""add bilingual names to industries and specializations, seed both

Revision ID: 9e21217ccbfb
Revises: e4c7a2b8f610
Create Date: 2026-07-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision: str = '9e21217ccbfb'
down_revision: Union[str, None] = 'e4c7a2b8f610'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name_en, name_ar)
INDUSTRIES = [
    ("Technology", "التقنية"),
    ("E-commerce", "التجارة الإلكترونية"),
    ("Healthcare", "الرعاية الصحية"),
    ("Education", "التعليم"),
    ("Finance", "المالية"),
    ("Real Estate", "العقارات"),
    ("Media & Entertainment", "الإعلام والترفيه"),
    ("Food & Beverage", "الأغذية والمشروبات"),
    ("Retail", "التجزئة"),
    ("Logistics & Transportation", "اللوجستيات والنقل"),
    ("Tourism & Hospitality", "السياحة والضيافة"),
    ("Manufacturing", "التصنيع"),
    ("Energy", "الطاقة"),
    ("Agriculture", "الزراعة"),
    ("Non-Profit", "القطاع غير الربحي"),
]

# Arabic backfill for specializations that may already exist (some environments
# were seeded manually, English-only, before this migration introduced name_ar).
EXISTING_SPECIALIZATION_TRANSLATIONS = {
    "Backend Development": "تطوير الخلفية",
    "Blockchain Development": "تطوير تقنية البلوك تشين",
    "Cloud Architecture": "هندسة الحوسبة السحابية",
    "Cybersecurity": "الأمن السيبراني",
    "Database Administration": "إدارة قواعد البيانات",
    "Data Engineering": "هندسة البيانات",
    "Data Science": "علم البيانات",
    "DevOps Engineering": "هندسة DevOps",
    "Embedded Systems": "الأنظمة المدمجة",
    "Frontend Development": "تطوير الواجهات الأمامية",
    "Full Stack Development": "التطوير المتكامل",
    "Game Development": "تطوير الألعاب",
    "Machine Learning Engineering": "هندسة تعلم الآلة",
    "Mobile App Development": "تطوير تطبيقات الجوال",
    "Network Engineering": "هندسة الشبكات",
    "Product Management": "إدارة المنتجات",
    "QA / Software Testing": "ضمان الجودة واختبار البرمجيات",
    "System Administration": "إدارة الأنظمة",
    "Technical Writing": "الكتابة التقنية",
    "UI/UX Design": "تصميم واجهة وتجربة المستخدم",
}

# New specializations not already covered by EXISTING_SPECIALIZATION_TRANSLATIONS
SPECIALIZATIONS = [
    ("Graphic Design", "التصميم الجرافيكي"),
    ("Data Analysis", "تحليل البيانات"),
    ("Project Management", "إدارة المشاريع"),
    ("Digital Marketing", "التسويق الرقمي"),
    ("Content Writing", "كتابة المحتوى"),
    ("Business Development", "تطوير الأعمال"),
    ("Finance & Accounting", "المالية والمحاسبة"),
    ("Legal", "الشؤون القانونية"),
    ("Human Resources", "الموارد البشرية"),
    ("Sales", "المبيعات"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # industries: name -> name_en/name_ar
    op.add_column('industries', sa.Column('name_en', sa.String(length=100), nullable=True))
    op.add_column('industries', sa.Column('name_ar', sa.String(length=100), nullable=True))
    op.execute("UPDATE industries SET name_en = name")
    op.drop_constraint('industries_name_key', 'industries', type_='unique')
    op.drop_column('industries', 'name')
    op.alter_column('industries', 'name_en', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('industries', 'name_ar', existing_type=sa.String(length=100), nullable=False)
    op.create_unique_constraint('uq_industries_name_en', 'industries', ['name_en'])
    op.create_unique_constraint('uq_industries_name_ar', 'industries', ['name_ar'])

    # specializations: name -> name_en/name_ar
    op.add_column('specializations', sa.Column('name_en', sa.String(length=100), nullable=True))
    op.add_column('specializations', sa.Column('name_ar', sa.String(length=100), nullable=True))
    op.execute("UPDATE specializations SET name_en = name")

    # backfill Arabic for rows that predate this migration
    conn.execute(
        sa.text("UPDATE specializations SET name_ar = :name_ar WHERE name_en = :name_en AND name_ar IS NULL"),
        [{"name_en": en, "name_ar": ar} for en, ar in EXISTING_SPECIALIZATION_TRANSLATIONS.items()],
    )

    op.drop_constraint('specializations_name_key', 'specializations', type_='unique')
    op.drop_column('specializations', 'name')
    op.alter_column('specializations', 'name_en', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('specializations', 'name_ar', existing_type=sa.String(length=100), nullable=False)
    op.create_unique_constraint('uq_specializations_name_en', 'specializations', ['name_en'])
    op.create_unique_constraint('uq_specializations_name_ar', 'specializations', ['name_ar'])

    conn.execute(
        sa.text(
            "INSERT INTO industries (id, name_en, name_ar, created_at) "
            "VALUES (:id, :name_en, :name_ar, now()) "
            "ON CONFLICT (name_en) DO NOTHING"
        ),
        [{"id": str(uuid.uuid4()), "name_en": en, "name_ar": ar} for en, ar in INDUSTRIES],
    )
    conn.execute(
        sa.text(
            "INSERT INTO specializations (id, name_en, name_ar, is_approved, created_at) "
            "VALUES (:id, :name_en, :name_ar, true, now()) "
            "ON CONFLICT (name_en) DO NOTHING"
        ),
        [{"id": str(uuid.uuid4()), "name_en": en, "name_ar": ar} for en, ar in SPECIALIZATIONS],
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM industries WHERE name_en IN :names").bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {"names": [en for en, _ in INDUSTRIES]},
    )
    conn.execute(
        sa.text("DELETE FROM specializations WHERE name_en IN :names").bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {"names": [en for en, _ in SPECIALIZATIONS]},
    )

    op.drop_constraint('uq_specializations_name_ar', 'specializations', type_='unique')
    op.drop_constraint('uq_specializations_name_en', 'specializations', type_='unique')
    op.add_column('specializations', sa.Column('name', sa.String(length=100), nullable=True))
    op.execute("UPDATE specializations SET name = name_en")
    op.alter_column('specializations', 'name', existing_type=sa.String(length=100), nullable=False)
    op.create_unique_constraint('specializations_name_key', 'specializations', ['name'])
    op.drop_column('specializations', 'name_ar')
    op.drop_column('specializations', 'name_en')

    op.drop_constraint('uq_industries_name_ar', 'industries', type_='unique')
    op.drop_constraint('uq_industries_name_en', 'industries', type_='unique')
    op.add_column('industries', sa.Column('name', sa.String(length=100), nullable=True))
    op.execute("UPDATE industries SET name = name_en")
    op.alter_column('industries', 'name', existing_type=sa.String(length=100), nullable=False)
    op.create_unique_constraint('industries_name_key', 'industries', ['name'])
    op.drop_column('industries', 'name_ar')
    op.drop_column('industries', 'name_en')
