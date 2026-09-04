from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mirror.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from mirror.modules.events.model import ActivityEvent
    from mirror.modules.reports.model import SessionReport
    from mirror.modules.users.model import User


class SessionStatus(StrEnum):
    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FocusSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "focus_sessions"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    goal: Mapped[str] = mapped_column(Text)
    planned_duration_minutes: Mapped[int] = mapped_column(Integer)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", native_enum=False),
        default=SessionStatus.ACTIVE,
        index=True,
    )
    client_timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    analysis_error_code: Mapped[str | None] = mapped_column(String(80))
    analysis_error_message: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="sessions")
    events: Mapped[list[ActivityEvent]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    report: Mapped[SessionReport | None] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )
