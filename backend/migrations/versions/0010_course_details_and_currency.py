"""Add editable student-facing course details and currency.

Revision ID: 0010_course_details_currency
Revises: 0009_merge_heads
Create Date: 2026-10-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_course_details_currency"
down_revision: Union[str, Sequence[str], None] = "0009_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The initial project migration builds tables from current model metadata.
    # On a brand-new database these fields may therefore already exist before
    # this migration is reached. Inspect first to support both new and existing
    # deployments without attempting to add duplicate columns.
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("courses")}
    if "price_currency" not in existing:
        op.add_column(
            "courses",
            sa.Column(
                "price_currency",
                sa.String(length=3),
                nullable=False,
                server_default="INR",
            ),
        )
    for name in ("learning_outcomes", "skills", "requirements", "projects", "learning_path", "ai_features", "included_features", "faqs"):
        if name not in existing:
            op.add_column("courses", sa.Column(name, sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("courses")}
    for name in ("faqs", "included_features", "ai_features", "learning_path", "projects", "requirements", "skills", "learning_outcomes", "price_currency"):
        if name in existing:
            op.drop_column("courses", name)
