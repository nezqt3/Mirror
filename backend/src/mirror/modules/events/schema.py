from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from mirror.modules.events.model import EventType


class EventCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    client_event_id: UUID | None = Field(
        default=None,
        validation_alias=AliasChoices("client_event_id", "id"),
    )
    event_type: EventType = Field(validation_alias=AliasChoices("event_type", "type"))
    occurred_at: datetime = Field(validation_alias=AliasChoices("occurred_at", "timestamp"))
    source: str | None = Field(default=None, max_length=255)
    payload: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_desktop_event_type(cls, value: Any) -> Any:
        aliases = {
            "application-focus": EventType.APP_FOCUS,
            "window-focus": EventType.WINDOW_FOCUS,
            "browser-navigation": EventType.URL_VISIT,
            "user-idle": EventType.IDLE_START,
            "user-active": EventType.IDLE_END,
        }
        return aliases.get(value, value)


class EventBatchCreate(BaseModel):
    events: list[EventCreate] = Field(min_length=1, max_length=1000)


class EventBatchAccepted(BaseModel):
    accepted: int
    duplicates: int
