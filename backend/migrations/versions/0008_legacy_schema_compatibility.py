"""Add nullable JSON metadata columns missing from older databases.

Revision ID: 0008_legacy_schema_compatibility
Revises: 0007_email_verification_expiry

Older LearnMate databases were bootstrapped with an earlier SQLAlchemy model
set. Several current models now include optional ``metadata_json`` columns,
but there was no migration to add those columns to an existing database.
That can surface as unrelated 500 errors when an AI conversation is opened
or when a student submits an assignment and learning activity is recorded.

This migration is deliberately idempotent and only adds a nullable column
when the corresponding table exists and the column is missing. Existing data
is preserved.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_legacy_schema_compatibility"
down_revision: Union[str, Sequence[str], None] = "0007_email_verification_expiry"
branch_labels = None
depends_on = None

_METADATA_TABLES = (
    "ai_messages",
    "ai_usage_logs",
    "learning_activity",
    "audit_logs",
    "notifications",
)


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(
        column.get("name") == column_name
        for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    for table_name in _METADATA_TABLES:
        if table_name not in tables:
            continue
        if not _has_column(inspector, table_name, "metadata_json"):
            op.add_column(
                table_name,
                sa.Column("metadata_json", sa.JSON(), nullable=True),
            )
        # Refresh the inspector after each possible DDL change so subsequent
        # checks remain correct on MySQL.
        inspector = sa.inspect(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    for table_name in reversed(_METADATA_TABLES):
        if table_name not in tables:
            continue
        if _has_column(inspector, table_name, "metadata_json"):
            op.drop_column(table_name, "metadata_json")
        inspector = sa.inspect(bind)
