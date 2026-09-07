"""Send synthetic focus sessions to the AI provider and print validated report JSON."""

import argparse
import asyncio
import json
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from mirror.core.config import get_settings
from mirror.db import models as _models  # noqa: F401
from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession
from mirror.services.analyzer_factory import create_analyzer

SCENARIOS = ("research_overrun", "deep_work_success", "fragmented_session")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=SCENARIOS, default="research_overrun")
    parser.add_argument("--all", action="store_true", help="Run all quality scenarios")
    parser.add_argument(
        "--locale",
        choices=("en", "zh-CN"),
        default="en",
        help="Language required for human-readable report values",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.ai_enabled:
        raise SystemExit("Set AI_ENABLED=true and AI_API_KEY in backend/.env first")

    analyzer = create_analyzer(settings)
    try:
        outputs = []
        selected = SCENARIOS if args.all else (args.scenario,)
        for scenario_name in selected:
            session, events = _scenario(scenario_name, args.locale)
            result = await analyzer.analyze(session, events)
            outputs.append(
                {
                    "scenario": scenario_name,
                    "session_id": str(session.id),
                    "status": "completed",
                    "analysis_locale": session.analysis_locale,
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
            )
    finally:
        await analyzer.aclose()

    print(json.dumps(outputs if args.all else outputs[0], ensure_ascii=False, indent=2))


def _scenario(name: str, analysis_locale: str) -> tuple[FocusSession, list[ActivityEvent]]:
    started_at = datetime.now(UTC) - timedelta(minutes=60)
    session = FocusSession(
        id=uuid4(),
        user_id=uuid4(),
        goal={
            "research_overrun": (
                "Закончить презентацию о рынке productivity-приложений и экспортировать "
                "финальную версию"
            ),
            "deep_work_success": "Исправить ошибку авторизации и завершить тесты",
            "fragmented_session": "Написать первый черновик статьи",
        }[name],
        planned_duration_minutes=60,
        analysis_locale=analysis_locale,
        started_at=started_at,
        ended_at=started_at + timedelta(minutes=60),
    )
    builders = {
        "research_overrun": _research_events,
        "deep_work_success": _deep_work_events,
        "fragmented_session": _fragmented_events,
    }
    return session, builders[name](session.id, started_at)


def _research_events(session_id: UUID, start: datetime) -> list[ActivityEvent]:
    events = [_event(session_id, start, EventType.APP_FOCUS, "Keynote")]
    queries = [
        "рынок productivity apps 2026",
        "productivity app market size",
        "productivity market statistics",
        "productivity market report",
        "focus app market data",
        "productivity tools market size",
        "productivity market data source",
    ]
    for index, query in enumerate(queries, start=1):
        events.append(
            _event(
                session_id,
                start + timedelta(minutes=8 + index * 5),
                EventType.URL_VISIT,
                "Chrome",
                {"domain": "google.com", "query": query},
            )
        )
    events.append(
        _event(
            session_id,
            start + timedelta(minutes=52),
            EventType.APP_FOCUS,
            "Keynote",
            {"title": "Mirror presentation — editing slide 8"},
        )
    )
    return events


def _deep_work_events(session_id: UUID, start: datetime) -> list[ActivityEvent]:
    return [
        _event(session_id, start, EventType.APP_FOCUS, "VS Code", {"title": "auth.py"}),
        _event(
            session_id,
            start + timedelta(minutes=28),
            EventType.WINDOW_FOCUS,
            "VS Code",
            {"title": "test_auth.py — all tests passed"},
        ),
        _event(
            session_id,
            start + timedelta(minutes=55),
            EventType.WINDOW_FOCUS,
            "Terminal",
            {"title": "pytest: 24 passed"},
        ),
    ]


def _fragmented_events(session_id: UUID, start: datetime) -> list[ActivityEvent]:
    sequence = [
        (0, EventType.APP_FOCUS, "Notes", {"title": "Article draft"}),
        (4, EventType.APP_FOCUS, "Telegram", {"title": "Chats"}),
        (7, EventType.APP_FOCUS, "Notes", {"title": "Article draft"}),
        (11, EventType.URL_VISIT, "Chrome", {"domain": "youtube.com"}),
        (18, EventType.APP_FOCUS, "Notes", {"title": "Article draft"}),
        (22, EventType.IDLE_START, "system", {}),
        (34, EventType.IDLE_END, "system", {}),
        (36, EventType.APP_FOCUS, "Telegram", {"title": "Chats"}),
        (42, EventType.APP_FOCUS, "Notes", {"title": "Article draft"}),
        (47, EventType.URL_VISIT, "Chrome", {"domain": "reddit.com"}),
        (54, EventType.APP_FOCUS, "Notes", {"title": "Article draft — 280 words"}),
    ]
    return [
        _event(session_id, start + timedelta(minutes=minute), event_type, source, payload)
        for minute, event_type, source, payload in sequence
    ]


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
