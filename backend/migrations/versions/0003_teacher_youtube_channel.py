"""Add teacher YouTube channel links.
Revision ID: 0003_teacher_youtube_channel
Revises: 0002_video_file_link
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_teacher_youtube_channel"
down_revision = "0002_video_file_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "teacher_youtube_channels" in tables:
        return

    op.create_table(
        "teacher_youtube_channels",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("teacher_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.String(length=64), nullable=False),
        sa.Column("channel_url", sa.String(length=500), nullable=False),
        sa.Column("channel_title", sa.String(length=300), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column("uploads_playlist_id", sa.String(length=64), nullable=True),
        sa.Column("subscriber_count", sa.BigInteger(), nullable=True),
        sa.Column("video_count", sa.BigInteger(), nullable=True),
        sa.Column("view_count", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("teacher_id", name="uq_teacher_youtube_channel_teacher"),
        sa.UniqueConstraint("channel_id", name="uq_teacher_youtube_channel_channel"),
    )
    op.create_index("ix_teacher_youtube_channels_teacher_id", "teacher_youtube_channels", ["teacher_id"], unique=False)
    op.create_index("ix_teacher_youtube_channels_channel_id", "teacher_youtube_channels", ["channel_id"], unique=False)
    op.create_index("ix_teacher_youtube_channels_is_active", "teacher_youtube_channels", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_teacher_youtube_channels_is_active", table_name="teacher_youtube_channels")
    op.drop_index("ix_teacher_youtube_channels_channel_id", table_name="teacher_youtube_channels")
    op.drop_index("ix_teacher_youtube_channels_teacher_id", table_name="teacher_youtube_channels")
    op.drop_table("teacher_youtube_channels")
