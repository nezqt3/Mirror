from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RewardsRead(BaseModel):
    xp: int = Field(ge=0)
    focus: int = Field(ge=0)
    stamina: int = Field(ge=0)
    execution: int = Field(ge=0)


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    status: Literal["completed"] = "completed"
    goal_completion: float | None = Field(default=None, ge=0, le=100)
    focus_score: int = Field(ge=0, le=100)
    deep_work_minutes: int = Field(ge=0)
    context_switches: int = Field(ge=0)
    main_bottleneck: str | None
    distractions: list[str]
    insights: list[str]
    next_session_advice: str | None
    rewards: RewardsRead
    created_at: datetime


class ReportPending(BaseModel):
    session_id: UUID
    status: Literal["processing"] = "processing"
    retry_after_ms: int = 2000


class ReportFailed(BaseModel):
    session_id: UUID
    status: Literal["failed"] = "failed"
    error_code: str
    can_retry: bool = True


ReportResponse = ReportRead | ReportPending | ReportFailed
