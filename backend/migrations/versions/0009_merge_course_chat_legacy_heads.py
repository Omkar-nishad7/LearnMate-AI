"""Merge course-scoped chat and legacy-schema compatibility migration heads.

Revision ID: 0009_merge_heads
Revises: 0008_course_scoped_chat, 0008_legacy_schema_compatibility
Create Date: 2026-10-10

This is an Alembic merge revision only. Both parent migrations are retained
and run before this revision; no schema changes are performed here.
"""

from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision: str = "0009_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "0008_course_scoped_chat",
    "0008_legacy_schema_compatibility",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge the two migration branches without changing the database schema."""
    pass


def downgrade() -> None:
    """Separate the migration branches; no schema changes need to be undone."""
    pass
