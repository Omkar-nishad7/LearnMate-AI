"""Merge the assignment schema and MCQ assignment migration heads.

Revision ID: 0006_merge_assignment_heads
Revises: 0005_assignments_schema, 0005_assignment_mcq_questions
"""
from typing import Sequence, Union

revision: str = "0006_merge_assignment_heads"
down_revision: Union[str, Sequence[str], None] = (
    "0005_assignments_schema",
    "0005_assignment_mcq_questions",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge-only revision. The two parent migrations contain the actual schema changes.
    pass


def downgrade() -> None:
    # Merge-only revision; downgrading proceeds to the two parent heads.
    pass
