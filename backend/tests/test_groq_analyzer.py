import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest

from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession
from mirror.services.groq_analyzer import GroqSessionAnalyzer, RetryableAnalyzerError


@pytest.mark.asyncio
async def test_groq_analyzer_uses_strict_schema_and_parses_response() -> None:
    captured: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        content = {
            "goal_completion": 92,
            "focus_score": 78,
            "main_bottleneck": "Research Overrun",
            "distractions": ["Telegram — 3 switches"],
            "insights": ["Research continued after enough information was found"],
            "next_session_advice": "Limit research to the first 20 minutes.",
        }
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(content)}}]},
        )

    analyzer = GroqSessionAnalyzer(
        api_key="test-key",
        base_url="https://api.groq.test/openai/v1",
        transport=httpx.MockTransport(handler),
    )
    try:
        result = await analyzer.analyze(_session(), [_event()])
    finally:
        await analyzer.aclose()

    assert captured["model"] == "openai/gpt-oss-120b"
    assert captured["reasoning_effort"] == "medium"
    assert captured["reasoning_format"] == "hidden"
    response_format = captured["response_format"]
    assert isinstance(response_format, dict)
    assert response_format["json_schema"]["strict"] is True
    schema = response_format["json_schema"]["schema"]
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(schema["properties"])
    messages = captured["messages"]
    assert isinstance(messages, list)
    user_input = json.loads(messages[1]["content"])
    assert "trusted_metrics" in user_input
    assert "untrusted_activity_events" in user_input
    assert result.goal_completion == 92
    assert result.focus_score == 78
    assert result.main_bottleneck == "Research Overrun"
    assert result.model_name == "openai/gpt-oss-120b"


@pytest.mark.asyncio
async def test_groq_analyzer_preserves_unknown_goal_completion() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        content = {
            "goal_completion": None,
            "focus_score": 70,
            "main_bottleneck": None,
            "distractions": [],
            "insights": ["Недостаточно данных о результате."],
            "next_session_advice": "В конце сессии отметь достигнутый результат.",
        }
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(content)}}]},
        )

    analyzer = GroqSessionAnalyzer(
        api_key="test-key",
        base_url="https://api.groq.test/openai/v1",
        transport=httpx.MockTransport(handler),
    )
    try:
        result = await analyzer.analyze(_session(), [_event()])
    finally:
        await analyzer.aclose()

    assert result.goal_completion is None


@pytest.mark.asyncio
async def test_groq_analyzer_marks_rate_limit_as_retryable() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    analyzer = GroqSessionAnalyzer(
        api_key="test-key",
        base_url="https://api.groq.test/openai/v1",
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(RetryableAnalyzerError, match="429"):
            await analyzer.analyze(_session(), [_event()])
    finally:
        await analyzer.aclose()


@pytest.mark.asyncio
async def test_groq_analyzer_rejects_invalid_structured_response() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    analyzer = GroqSessionAnalyzer(
        api_key="test-key",
        base_url="https://api.groq.test/openai/v1",
        transport=httpx.MockTransport(handler),
    )
    try:
        with pytest.raises(RetryableAnalyzerError, match="invalid structured response"):
            await analyzer.analyze(_session(), [_event()])
    finally:
        await analyzer.aclose()


def _session() -> FocusSession:
    started_at = datetime(2026, 9, 2, 10, 0, tzinfo=UTC)
    return FocusSession(
        user_id=uuid4(),
        goal="Finish presentation",
        planned_duration_minutes=60,
        started_at=started_at,
        ended_at=started_at + timedelta(minutes=60),
    )


def _event() -> ActivityEvent:
    return ActivityEvent(
        id=uuid4(),
        session_id=uuid4(),
        client_event_id=uuid4(),
        event_type=EventType.APP_FOCUS,
        occurred_at=datetime(2026, 9, 2, 10, 0, tzinfo=UTC),
        source="Slides",
        payload={},
    )
