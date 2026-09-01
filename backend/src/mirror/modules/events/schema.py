from datetime import datetime

from pydantic import BaseModel, Field

from mirror.modules.events.model import EventType


class EventCreate(BaseModel):
    event_type: EventType
    occurred_at: datetime
    source: str | None = Field(default=None, max_length=255)
    payload: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class EventBatchCreate(BaseModel):
    events: list[EventCreate] = Field(min_length=1, max_length=1000)


class EventBatchAccepted(BaseModel):
    accepted: int
