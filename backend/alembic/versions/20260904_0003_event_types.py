"""Allow all raw activity event types."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260904_0003"
down_revision: str | None = "20260902_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "activity_events",
        "event_type",
        existing_type=sa.String(length=12),
        type_=sa.String(length=32),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "activity_events",
        "event_type",
        existing_type=sa.String(length=32),
        type_=sa.String(length=12),
        existing_nullable=False,
    )
