"""add MCQ questions to assignments

Revision ID: 0005_assignment_mcq_questions
Revises: 0004_merge_heads
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_assignment_mcq_questions"
down_revision = "0004_merge_heads"
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("assignments")
    }

    if "questions" not in existing_columns:
        op.add_column(
            "assignments",
            sa.Column("questions", sa.JSON(), nullable=True),
        )

        
def downgrade() -> None:
    with op.batch_alter_table("assignments") as batch_op:
        batch_op.drop_column("questions")
