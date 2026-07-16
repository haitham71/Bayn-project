"""seed skills (english only)

Revision ID: 2623d0c33a1a
Revises: 9e21217ccbfb
Create Date: 2026-07-16 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers, used by Alembic.
revision: str = '2623d0c33a1a'
down_revision: Union[str, None] = '9e21217ccbfb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SKILLS = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "PHP", "Ruby", "Go", "Swift", "Kotlin",
    "React", "Vue.js", "Angular", "Node.js", "Django", "Flask", "Laravel", "Spring Boot",
    "Flutter", "React Native", "HTML", "CSS", "Tailwind CSS",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis",
    "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud Platform", "Git", "CI/CD",
    "Figma", "Adobe XD", "Photoshop", "Illustrator",
    "SEO", "Google Analytics", "Content Marketing", "Copywriting",
    "Agile", "Scrum", "Excel", "Communication", "Leadership", "Problem Solving",
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO skills (id, name, is_approved, created_at) "
            "VALUES (:id, :name, true, now()) "
            "ON CONFLICT (name) DO NOTHING"
        ),
        [{"id": str(uuid.uuid4()), "name": name} for name in SKILLS],
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM skills WHERE name IN :names").bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {"names": SKILLS},
    )
