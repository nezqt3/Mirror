"""Add daily focus-session streak to Mirror Character."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260904_0004"
down_revision: str | None = "20260904_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "characters",
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "characters",
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("characters", sa.Column("last_session_date", sa.Date()))


def downgrade() -> None:
    op.drop_column("characters", "last_session_date")
    op.drop_column("characters", "longest_streak")
    op.drop_column("characters", "current_streak")
