"""Send a synthetic focus session to the configured AI provider and print the report JSON."""

import asyncio
import json
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from mirror.core.config import get_settings
from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession
from mirror.services.analyzer_factory import create_analyzer


async def main() -> None:
    settings = get_settings()
    if not settings.ai_enabled:
        raise SystemExit("Set AI_ENABLED=true and AI_API_KEY in backend/.env first")

    started_at = datetime.now(UTC) - timedelta(minutes=60)
    session = FocusSession(
        id=uuid4(),
        user_id=uuid4(),
        goal="Закончить презентацию",
        planned_duration_minutes=60,
        started_at=started_at,
        ended_at=started_at + timedelta(minutes=60),
    )
    events = [
        _event(session.id, started_at, EventType.APP_FOCUS, "Presentation Editor"),
        _event(
            session.id,
            started_at + timedelta(minutes=12),
            EventType.APP_FOCUS,
            "Browser Research",
            {"query": "presentation market data"},
        ),
        _event(
            session.id,
            started_at + timedelta(minutes=18),
            EventType.URL_VISIT,
            "Browser Research",
            {"query": "presentation market statistics"},
        ),
        _event(
            session.id,
            started_at + timedelta(minutes=24),
            EventType.URL_VISIT,
            "Browser Research",
            {"query": "presentation market data source"},
        ),
        _event(
            session.id,
            started_at + timedelta(minutes=30),
            EventType.APP_FOCUS,
            "Presentation Editor",
        ),
    ]

    analyzer = create_analyzer(settings)
    try:
        result = await analyzer.analyze(session, events)
    finally:
        await analyzer.aclose()

    output = {
        "session_id": str(session.id),
        "status": "completed",
        "goal_completion": result.goal_completion,
        "focus_score": result.focus_score,
        "deep_work_minutes": result.deep_work_minutes,
        "context_switches": result.context_switches,
        "main_bottleneck": result.main_bottleneck,
        "distractions": result.distractions,
        "insights": result.insights,
        "next_session_advice": result.next_session_advice,
        "rewards": asdict(result.rewards),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


def _event(
    session_id: UUID,
    occurred_at: datetime,
    event_type: EventType,
    source: str,
    payload: dict[str, str] | None = None,
) -> ActivityEvent:
    return ActivityEvent(
        id=uuid4(),
        session_id=session_id,
        client_event_id=uuid4(),
        event_type=event_type,
        occurred_at=occurred_at,
        source=source,
        payload=payload or {},
    )


if __name__ == "__main__":
    asyncio.run(main())
