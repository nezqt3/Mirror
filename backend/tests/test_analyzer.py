from datetime import UTC, datetime, timedelta
from uuid import uuid4

from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession
from mirror.services.analyzer import build_analysis_input, calculate_rewards


def test_build_analysis_input_calculates_deterministic_metrics() -> None:
    started_at = datetime(2026, 9, 2, 10, 0, tzinfo=UTC)
    session = FocusSession(
        user_id=uuid4(),
        goal="Finish presentation",
        planned_duration_minutes=60,
        started_at=started_at,
        ended_at=started_at + timedelta(minutes=60),
    )
    events = [
        _event(started_at, EventType.APP_FOCUS, "Slides"),
        _event(started_at + timedelta(minutes=15), EventType.WINDOW_FOCUS, "Slides"),
        _event(started_at + timedelta(minutes=20), EventType.APP_FOCUS, "Browser"),
        _event(started_at + timedelta(minutes=30), EventType.IDLE_START, "system"),
        _event(started_at + timedelta(minutes=40), EventType.IDLE_END, "system"),
    ]

    result = build_analysis_input(session, events)

    assert result.actual_duration_minutes == 60
    assert result.metrics.context_switches == 1
    assert result.metrics.idle_minutes == 10
    assert result.metrics.deep_work_minutes == 45
    assert result.metrics.top_sources[0] == {"source": "Slides", "events": 2}


def test_calculate_rewards_is_bounded_and_deterministic() -> None:
    rewards = calculate_rewards(goal_completion=92, focus_score=82, deep_work_minutes=64)

    assert rewards.xp == 140
    assert rewards.focus == 2
    assert rewards.stamina == 1
    assert rewards.execution == 3


def _event(
    occurred_at: datetime,
    event_type: EventType,
    source: str,
) -> ActivityEvent:
    return ActivityEvent(
        id=uuid4(),
        session_id=uuid4(),
        client_event_id=uuid4(),
        event_type=event_type,
        occurred_at=occurred_at,
        source=source,
        payload={},
    )
