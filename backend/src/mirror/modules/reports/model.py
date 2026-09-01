from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mirror.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from mirror.modules.sessions.model import FocusSession


class SessionReport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "session_reports"

    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("focus_sessions.id", ondelete="CASCADE"), unique=True
    )
    goal_completion: Mapped[float] = mapped_column(Float)
    focus_score: Mapped[int] = mapped_column(Integer)
    deep_work_minutes: Mapped[int] = mapped_column(Integer)
    context_switches: Mapped[int] = mapped_column(Integer)
    bottlenecks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    distractions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    insights: Mapped[list[str]] = mapped_column(JSONB, default=list)
    next_session_advice: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str | None]

    session: Mapped[FocusSession] = relationship(back_populates="report")
