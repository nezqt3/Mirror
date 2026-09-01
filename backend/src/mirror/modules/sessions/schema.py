from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from mirror.modules.sessions.model import SessionStatus


class SessionCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)
    planned_duration_minutes: int = Field(ge=5, le=480)
    client_timezone: str = Field(default="UTC", max_length=64)


class SessionFinish(BaseModel):
    ended_at: datetime | None = None


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
