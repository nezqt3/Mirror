from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    goal_completion: float = Field(ge=0, le=100)
    focus_score: int = Field(ge=0, le=100)
    deep_work_minutes: int = Field(ge=0)
    context_switches: int = Field(ge=0)
    bottlenecks: list[dict[str, Any]]
    distractions: list[dict[str, Any]]
    insights: list[str]
    next_session_advice: str
    created_at: datetime
