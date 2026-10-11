"""Create assignment tables for databases bootstrapped before assignments existed.

Revision ID: 0005_assignments_schema
Revises: 0004_merge_heads
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_assignments_schema"
down_revision: Union[str, Sequence[str], None] = "0004_merge_heads"
branch_labels = None
depends_on = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)

    # The original bootstrap migration used Base.metadata.create_all().
    # If the database was initialized before the assignment models existed,
    # the ORM code is present but these tables are missing. Create only the
    # missing tables so existing data/schema is preserved.
    if "assignments" not in tables:
        op.create_table(
            "assignments",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("creator_id", sa.BigInteger(), nullable=False),
            sa.Column("course_id", sa.BigInteger(), nullable=False),
            sa.Column("title", sa.String(length=300), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("instructions", sa.Text(), nullable=True),
            sa.Column("attachment_url", sa.String(length=500), nullable=True),
            sa.Column("max_score", sa.Float(), nullable=False, server_default="100"),
            sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("allow_late", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column(
                "status",
                sa.Enum("DRAFT", "PUBLISHED", "CLOSED", name="assignmentstatus"),
                nullable=False,
                server_default="DRAFT",
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_assignments_creator_id", "assignments", ["creator_id"])
        op.create_index("ix_assignments_course_id", "assignments", ["course_id"])
        op.create_index("ix_assignments_due_at", "assignments", ["due_at"])
        op.create_index("ix_assignments_status", "assignments", ["status"])

    # Re-read table names because the first table may have just been created.
    tables = _tables(bind)
    if "assignment_submissions" not in tables:
        op.create_table(
            "assignment_submissions",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("assignment_id", sa.BigInteger(), nullable=False),
            sa.Column("student_id", sa.BigInteger(), nullable=False),
            sa.Column("content", sa.Text(), nullable=True),
            sa.Column("file_url", sa.String(length=500), nullable=True),
            sa.Column(
                "status",
                sa.Enum("SUBMITTED", "GRADED", "RETURNED", "LATE", name="submissionstatus"),
                nullable=False,
                server_default="SUBMITTED",
            ),
            sa.Column("score", sa.Float(), nullable=True),
            sa.Column("feedback", sa.Text(), nullable=True),
            sa.Column("graded_by", sa.BigInteger(), nullable=True),
            sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["graded_by"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_assignment_submissions_assignment_id", "assignment_submissions", ["assignment_id"])
        op.create_index("ix_assignment_submissions_student_id", "assignment_submissions", ["student_id"])
        op.create_index("ix_assignment_submissions_status", "assignment_submissions", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    tables = _tables(bind)

    if "assignment_submissions" in tables:
        op.drop_index("ix_assignment_submissions_status", table_name="assignment_submissions")
        op.drop_index("ix_assignment_submissions_student_id", table_name="assignment_submissions")
        op.drop_index("ix_assignment_submissions_assignment_id", table_name="assignment_submissions")
        op.drop_table("assignment_submissions")

    tables = _tables(bind)
    if "assignments" in tables:
        op.drop_index("ix_assignments_status", table_name="assignments")
        op.drop_index("ix_assignments_due_at", table_name="assignments")
        op.drop_index("ix_assignments_course_id", table_name="assignments")
        op.drop_index("ix_assignments_creator_id", table_name="assignments")
        op.drop_table("assignments")
