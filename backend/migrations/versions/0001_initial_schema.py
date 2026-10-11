"""Create the initial LearnMate AI database schema.

Revision ID: 0001_initial_schema
Revises:
"""
from typing import Sequence, Union

from alembic import op

from app.db.base import Base
import app.models  # noqa: F401 - register every model before create_all/drop_all

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The project previously shipped without the migrations directory even
    # though alembic.ini pointed to it. Using SQLAlchemy metadata here gives
    # us a deterministic bootstrap for the current schema and lets future
    # migrations be added normally.
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
