"""merge video user state and teacher youtube channel heads

Revision ID: 0004_merge_heads
Revises: 0003_teacher_youtube_channel, 0003_video_user_state
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0004_merge_heads"

down_revision: Union[str, Sequence[str], None] = (
    "0003_teacher_youtube_channel",
    "0003_video_user_state",
)

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass