"""Add storage file link to videos.
Revision ID: 0002_video_file_link
Revises: 0001_initial_schema
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_video_file_link"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("videos")}
    if "file_id" in columns:
        return
    op.add_column("videos", sa.Column("file_id", sa.BigInteger(), nullable=True))
    op.create_index("ix_videos_file_id", "videos", ["file_id"])
    op.create_foreign_key(
        "fk_videos_file_id_files", "videos", "files", ["file_id"], ["id"], ondelete="SET NULL"
    )

def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("videos")}
    if "file_id" not in columns:
        return
    # Drop FK/index only when present; names are deterministic in this migration.
    try:
        op.drop_constraint("fk_videos_file_id_files", "videos", type_="foreignkey")
    except Exception:
        pass
    try:
        op.drop_index("ix_videos_file_id", table_name="videos")
    except Exception:
        pass
    op.drop_column("videos", "file_id")
