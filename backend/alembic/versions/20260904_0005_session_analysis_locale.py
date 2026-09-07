"""Add explicit output locale to focus sessions.

Revision ID: 20260904_0005
Revises: 20260904_0004
Create Date: 2026-09-04
"""

import sqlalchemy as sa

from alembic import op

revision = "20260904_0005"
down_revision = "20260904_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "focus_sessions",
        sa.Column("analysis_locale", sa.String(length=10), nullable=False, server_default="en"),
    )
    op.create_check_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        "analysis_locale IN ('en', 'zh-CN')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        type_="check",
    )
    op.drop_column("focus_sessions", "analysis_locale")
