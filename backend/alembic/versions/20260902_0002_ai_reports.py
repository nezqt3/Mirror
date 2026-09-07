"""Add production AI report fields and failure state metadata."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260902_0002"
down_revision: str | None = "20260901_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("focus_sessions", sa.Column("analysis_error_code", sa.String(80)))
    op.add_column("focus_sessions", sa.Column("analysis_error_message", sa.Text()))

    op.add_column(
        "activity_events",
        sa.Column("client_event_id", postgresql.UUID(as_uuid=True)),
    )
    op.create_unique_constraint(
        "uq_activity_events_session_client_event",
        "activity_events",
        ["session_id", "client_event_id"],
    )

    op.alter_column("session_reports", "goal_completion", nullable=True)
    op.add_column("session_reports", sa.Column("main_bottleneck", sa.Text()))
    op.add_column(
        "session_reports",
        sa.Column(
            "rewards",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.alter_column("session_reports", "next_session_advice", nullable=True)
    op.drop_column("session_reports", "bottlenecks")


def downgrade() -> None:
    op.add_column(
        "session_reports",
        sa.Column(
            "bottlenecks",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.alter_column("session_reports", "next_session_advice", nullable=False)
    op.drop_column("session_reports", "rewards")
    op.drop_column("session_reports", "main_bottleneck")
    op.alter_column("session_reports", "goal_completion", nullable=False)

    op.drop_constraint(
        "uq_activity_events_session_client_event",
        "activity_events",
        type_="unique",
    )
    op.drop_column("activity_events", "client_event_id")

    op.drop_column("focus_sessions", "analysis_error_message")
    op.drop_column("focus_sessions", "analysis_error_code")
