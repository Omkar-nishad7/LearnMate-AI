"""Add per-user video playback and watch-later state."""

from alembic import op
import sqlalchemy as sa

revision = "0003_video_user_state"
down_revision = "0002_video_file_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "video_user_state",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("video_id", sa.BigInteger(), nullable=False),
        sa.Column("saved_for_later", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_position_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("watched_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_watched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "video_id", name="uq_video_user_state_user_video"),
    )
    op.create_index("ix_video_user_state_user_id", "video_user_state", ["user_id"])
    op.create_index("ix_video_user_state_video_id", "video_user_state", ["video_id"])
    op.create_index("ix_video_user_state_user_saved", "video_user_state", ["user_id", "saved_for_later"])
    op.create_index("ix_video_user_state_user_updated", "video_user_state", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_video_user_state_user_updated", table_name="video_user_state")
    op.drop_index("ix_video_user_state_user_saved", table_name="video_user_state")
    op.drop_index("ix_video_user_state_video_id", table_name="video_user_state")
    op.drop_index("ix_video_user_state_user_id", table_name="video_user_state")
    op.drop_table("video_user_state")
