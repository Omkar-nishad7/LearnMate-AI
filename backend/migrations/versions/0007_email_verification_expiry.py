"""Restore the email-verification migration revision expected by existing databases.

Revision ID: 0007_email_verification_expiry
Revises: 0006_merge_assignment_heads

The deployed database may already be stamped at this revision. The current
application model does not contain an email-verification-expiry column, so
this compatibility migration intentionally performs no schema change. Its
purpose is to restore the missing Alembic revision and allow the migration
chain to load consistently.
"""

from typing import Sequence, Union


revision: str = "0007_email_verification_expiry"
down_revision: Union[str, Sequence[str], None] = "0006_merge_assignment_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
