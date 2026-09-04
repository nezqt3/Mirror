from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


class RawModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        populate_by_name=True,
    )


class RawEventPlatform(StrEnum):
    MACOS = "macos"
    WINDOWS = "windows"


class RawEventSource(StrEnum):
    SWIFT_NATIVE = "swift_native"
    CSHARP_NATIVE = "csharp_native"
    ELECTRON = "electron"
    BROWSER_EXTENSION = "browser_extension"


class BaseRawEvent(RawModel):
    schema_version: Literal[1]
    event_id: UUID
    session_id: UUID
    user_id: UUID
    producer_id: str = Field(min_length=1, max_length=160)
    producer_sequence: int = Field(ge=0)
    timestamp: AwareDatetime
    monotonic_ms: int = Field(ge=0)
    platform: RawEventPlatform
    source: RawEventSource


class AppFocusData(RawModel):
    process_id: int = Field(ge=0)
    app_name: str = Field(min_length=1, max_length=160)
    bundle_id: str | None = Field(default=None, max_length=255)
    executable_path: str | None = Field(default=None, max_length=1024)
    executable_name: str | None = Field(default=None, max_length=255)


class AppFocusEvent(BaseRawEvent):
    type: Literal["app_focus"]
    data: AppFocusData


class WindowBounds(RawModel):
    x: int
    y: int
    width: int = Field(ge=0)
    height: int = Field(ge=0)


class WindowFocusData(RawModel):
    process_id: int = Field(ge=0)
    window_id: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=500)
    bounds: WindowBounds | None = None
    is_fullscreen: bool | None = None


class WindowFocusEvent(BaseRawEvent):
    type: Literal["window_focus"]
    data: WindowFocusData


class BrowserNavigationData(RawModel):
    browser: str = Field(min_length=1, max_length=160)
    tab_id: str | None = Field(default=None, max_length=255)
    url: str | None = Field(default=None, max_length=4096)
    domain: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=500)
    incognito: bool | None = None
    transition: Literal["typed", "link", "reload", "redirect", "unknown"] | None = None

    @field_validator("incognito")
    @classmethod
    def reject_incognito_capture(cls, value: bool | None) -> bool | None:
        if value is True:
            raise ValueError("incognito activity must not be uploaded")
        return value


class BrowserNavigationEvent(BaseRawEvent):
    type: Literal["browser_navigation"]
    data: BrowserNavigationData


class IdleStartData(RawModel):
    idle_for_ms: int = Field(ge=0)


class IdleStartEvent(BaseRawEvent):
    type: Literal["idle_start"]
    data: IdleStartData


class IdleEndData(RawModel):
    idle_duration_ms: int = Field(ge=0)


class IdleEndEvent(BaseRawEvent):
    type: Literal["idle_end"]
    data: IdleEndData


class UserInputActivityData(RawModel):
    interval_ms: int = Field(gt=0)
    keyboard_events: int = Field(ge=0)
    mouse_clicks: int = Field(ge=0)
    mouse_move_distance: float | None = Field(default=None, ge=0)
    scroll_events: int = Field(ge=0)


class UserInputActivityEvent(BaseRawEvent):
    type: Literal["input_activity"]
    data: UserInputActivityData


class ScreenshotData(RawModel):
    screenshot_id: UUID
    display_id: str | None = Field(default=None, max_length=255)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    active_process_id: int | None = Field(default=None, ge=0)
    active_window_id: str | None = Field(default=None, max_length=255)
    storage_key: str | None = Field(default=None, max_length=1024)
    sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")


class ScreenshotEvent(BaseRawEvent):
    type: Literal["screenshot"]
    data: ScreenshotData


class SessionStartData(RawModel):
    goal: str | None = Field(default=None, max_length=2000)
    planned_duration_sec: int | None = Field(default=None, ge=1, le=28_800)


class SessionStartEvent(BaseRawEvent):
    type: Literal["session_start"]
    data: SessionStartData


class SessionEndData(RawModel):
    end_reason: Literal["completed", "user_stopped", "app_closed", "crash"]


class SessionEndEvent(BaseRawEvent):
    type: Literal["session_end"]
    data: SessionEndData


class HeartbeatData(RawModel):
    active_process_id: int | None = Field(default=None, ge=0)
    active_window_id: str | None = Field(default=None, max_length=255)
    idle: bool


class HeartbeatEvent(BaseRawEvent):
    type: Literal["heartbeat"]
    data: HeartbeatData


RawActivityEvent = Annotated[
    AppFocusEvent
    | WindowFocusEvent
    | BrowserNavigationEvent
    | IdleStartEvent
    | IdleEndEvent
    | UserInputActivityEvent
    | ScreenshotEvent
    | SessionStartEvent
    | SessionEndEvent
    | HeartbeatEvent,
    Field(discriminator="type"),
]


class RawEventBatchCreate(RawModel):
    schema_version: Literal[1]
    session_id: UUID
    sent_at: AwareDatetime
    events: list[RawActivityEvent] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_batch_identity(self) -> RawEventBatchCreate:
        event_ids = [event.event_id for event in self.events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("eventId values must be unique within a batch")
        producer_positions = [
            (event.producer_id, event.producer_sequence) for event in self.events
        ]
        if len(producer_positions) != len(set(producer_positions)):
            raise ValueError("producerSequence must be unique for each producer within a batch")
        return self
