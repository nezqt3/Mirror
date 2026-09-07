from datetime import UTC, datetime
from uuid import uuid4

from mirror.modules.events.model import EventType
from mirror.modules.events.schema import EventCreate
from mirror.modules.reports.schema import ReportPending, ReportRead


def test_desktop_event_contract_is_normalized() -> None:
    event_id = uuid4()
    event = EventCreate.model_validate(
        {
            "id": str(event_id),
            "type": "application-focus",
            "timestamp": "2026-09-02T10:00:00Z",
            "source": "Slides",
            "payload": {},
        }
    )

    assert event.client_event_id == event_id
    assert event.event_type == EventType.APP_FOCUS
    assert event.occurred_at == datetime(2026, 9, 2, 10, 0, tzinfo=UTC)


def test_completed_report_contract() -> None:
    report = ReportRead.model_validate(
        {
            "session_id": uuid4(),
            "goal_completion": 92,
            "focus_score": 78,
            "deep_work_minutes": 64,
            "context_switches": 12,
            "main_bottleneck": "Research Overrun",
            "distractions": ["Telegram — 3 switches"],
            "insights": ["Research continued longer than necessary"],
            "next_session_advice": "Limit research to 20 minutes.",
            "rewards": {
                "xp": 120,
                "focus": 2,
                "stamina": 1,
                "execution": 3,
                "discipline": 1,
            },
            "created_at": datetime.now(UTC),
        }
    )

    assert report.status == "completed"
    assert report.rewards.xp == 120
    assert report.rewards.discipline == 1


def test_processing_report_contract() -> None:
    pending = ReportPending(session_id=uuid4())

    assert pending.status == "processing"
    assert pending.retry_after_ms == 2000
