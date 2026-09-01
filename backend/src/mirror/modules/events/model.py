from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mirror.db.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from mirror.modules.sessions.model import FocusSession


class EventType(StrEnum):
    APP_FOCUS = "app_focus"
    WINDOW_FOCUS = "window_focus"
    URL_VISIT = "url_visit"
    IDLE_START = "idle_start"
    IDLE_END = "idle_end"
    SCREENSHOT = "screenshot"


class ActivityEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "activity_events"
    __table_args__ = (Index("ix_events_session_occurred", "session_id", "occurred_at"),)

    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("focus_sessions.id", ondelete="CASCADE")
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="activity_event_type", native_enum=False)
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str | None] = mapped_column(String(255))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    session: Mapped[FocusSession] = relationship(back_populates="events")
