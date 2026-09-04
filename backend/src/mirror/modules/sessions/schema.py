from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from mirror.modules.sessions.model import SessionStatus


class SessionCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)
    planned_duration_minutes: int = Field(ge=5, le=480)
    client_timezone: str = Field(default="UTC", max_length=64)

    @field_validator("client_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("client_timezone must be a valid IANA timezone") from exc
        return value


class SessionFinish(BaseModel):
    ended_at: AwareDatetime | None = None


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal: str
    planned_duration_minutes: int
    status: SessionStatus
    client_timezone: str
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
