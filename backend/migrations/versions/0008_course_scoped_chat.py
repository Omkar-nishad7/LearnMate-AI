"""Ensure chat tables exist and scope conversations to a course.

Revision ID: 0008_course_scoped_chat
Revises: 0007_email_verification_expiry
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_course_scoped_chat"
down_revision = "0007_email_verification_expiry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "conversations" not in tables:
        op.create_table(
            "conversations",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("user_a_id", sa.BigInteger(), nullable=False),
            sa.Column("user_b_id", sa.BigInteger(), nullable=False),
            sa.Column("course_id", sa.BigInteger(), nullable=True),
            sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_a_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_b_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_a_id", "user_b_id", "course_id", name="uq_conversation_course_pair"),
        )
        op.create_index("ix_conversations_user_a_id", "conversations", ["user_a_id"])
        op.create_index("ix_conversations_user_b_id", "conversations", ["user_b_id"])
        tables.add("conversations")
    else:
        constraints = {c.get("name") for c in inspector.get_unique_constraints("conversations")}
        columns = {c["name"] for c in inspector.get_columns("conversations")}
        if "course_id" not in columns:
            op.add_column("conversations", sa.Column("course_id", sa.BigInteger(), nullable=True))
            op.create_foreign_key("fk_conversations_course_id_courses", "conversations", "courses", ["course_id"], ["id"], ondelete="SET NULL")
        if "uq_conversation_pair" in constraints:
            op.drop_constraint("uq_conversation_pair", "conversations", type_="unique")
        constraints = {c.get("name") for c in sa.inspect(bind).get_unique_constraints("conversations")}
        if "uq_conversation_course_pair" not in constraints:
            op.create_unique_constraint("uq_conversation_course_pair", "conversations", ["user_a_id", "user_b_id", "course_id"])

    tables = set(sa.inspect(bind).get_table_names())
    if "messages" not in tables:
        op.create_table(
            "messages",
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("conversation_id", sa.BigInteger(), nullable=False),
            sa.Column("sender_id", sa.BigInteger(), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
        op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
        op.create_index("ix_messages_is_read", "messages", ["is_read"])
        op.create_index("ix_messages_conversation_created", "messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    # Preserve chat history on downgrade; this migration repairs an existing feature.
    pass
