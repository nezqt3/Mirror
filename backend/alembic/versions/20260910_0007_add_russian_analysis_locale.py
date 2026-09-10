"""Allow Russian as a session analysis locale.

Revision ID: 20260910_0007
Revises: 20260905_0006
"""

import sqlalchemy as sa

from alembic import op

revision = "20260910_0007"
down_revision = "20260905_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        type_="check",
    )
    op.create_check_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        "analysis_locale IN ('en', 'zh-CN', 'ru')",
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE focus_sessions SET analysis_locale = 'en' WHERE analysis_locale = 'ru'")
    )
    op.drop_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        type_="check",
    )
    op.create_check_constraint(
        "ck_focus_sessions_analysis_locale",
        "focus_sessions",
        "analysis_locale IN ('en', 'zh-CN')",
    )
