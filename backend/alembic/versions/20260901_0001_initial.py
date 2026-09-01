"""Initial Mirror MVP schema."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260901_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"])

    op.create_table(
        "characters",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("avatar_key", sa.String(512)),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("focus", sa.Integer(), nullable=False),
        sa.Column("stamina", sa.Integer(), nullable=False),
        sa.Column("execution", sa.Integer(), nullable=False),
        sa.Column("discipline", sa.Integer(), nullable=False),
        sa.Column("adaptability", sa.Integer(), nullable=False),
        sa.Column("energy", sa.Integer(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name=op.f("fk_characters_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_characters")),
        sa.UniqueConstraint("user_id", name=op.f("uq_characters_user_id")),
    )

    op.create_table(
        "focus_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("planned_duration_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "processing",
                "completed",
                "failed",
                name="session_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("client_timezone", sa.String(64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_focus_sessions_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_focus_sessions")),
    )
    op.create_index(op.f("ix_focus_sessions_status"), "focus_sessions", ["status"])
    op.create_index(op.f("ix_focus_sessions_user_id"), "focus_sessions", ["user_id"])

    op.create_table(
        "activity_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "app_focus",
                "window_focus",
                "url_visit",
                "idle_start",
                "idle_end",
                "screenshot",
                name="activity_event_type",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(255)),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["focus_sessions.id"],
            ondelete="CASCADE",
            name=op.f("fk_activity_events_session_id_focus_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activity_events")),
    )
    op.create_index("ix_events_session_occurred", "activity_events", ["session_id", "occurred_at"])

    op.create_table(
        "session_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal_completion", sa.Float(), nullable=False),
        sa.Column("focus_score", sa.Integer(), nullable=False),
        sa.Column("deep_work_minutes", sa.Integer(), nullable=False),
        sa.Column("context_switches", sa.Integer(), nullable=False),
        sa.Column("bottlenecks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("distractions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("insights", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("next_session_advice", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["focus_sessions.id"],
            ondelete="CASCADE",
            name=op.f("fk_session_reports_session_id_focus_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_reports")),
        sa.UniqueConstraint("session_id", name=op.f("uq_session_reports_session_id")),
    )


def downgrade() -> None:
    op.drop_table("session_reports")
    op.drop_index("ix_events_session_occurred", table_name="activity_events")
    op.drop_table("activity_events")
    op.drop_index(op.f("ix_focus_sessions_user_id"), table_name="focus_sessions")
    op.drop_index(op.f("ix_focus_sessions_status"), table_name="focus_sessions")
    op.drop_table("focus_sessions")
    op.drop_table("characters")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
