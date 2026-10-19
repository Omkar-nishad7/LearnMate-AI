"""Add course-scoped uploaded learning resources.

Revision ID: 0011_course_resources
Revises: 0010_course_details_currency
Create Date: 2026-10-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0011_course_resources"
down_revision: Union[str, Sequence[str], None] = "0010_course_details_currency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "course_resources" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "course_resources",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column("lesson_id", sa.BigInteger(), nullable=True),
        sa.Column("file_id", sa.BigInteger(), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("resource_type", sa.String(length=30), nullable=False, server_default="document"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lesson_id"], ["course_lessons.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_course_resources_course_id", "course_resources", ["course_id"])
    op.create_index("ix_course_resources_lesson_id", "course_resources", ["lesson_id"])
    op.create_index("ix_course_resources_file_id", "course_resources", ["file_id"])
    op.create_index("ix_course_resources_created_by", "course_resources", ["created_by"])
    op.create_index("ix_course_resources_course_lesson", "course_resources", ["course_id", "lesson_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if "course_resources" not in sa.inspect(bind).get_table_names():
        return
    for index in ("ix_course_resources_course_lesson", "ix_course_resources_created_by", "ix_course_resources_file_id", "ix_course_resources_lesson_id", "ix_course_resources_course_id"):
        op.drop_index(index, table_name="course_resources")
    op.drop_table("course_resources")
