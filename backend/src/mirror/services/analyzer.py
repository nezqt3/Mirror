from __future__ import annotations

import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession


@dataclass(frozen=True)
class SessionMetrics:
    duration_minutes: int
    active_minutes: int
    deep_work_minutes: int
    context_switches: int
    idle_minutes: int
    idle_percent: int
    top_sources: list[dict[str, str | int]]


@dataclass(frozen=True)
class AnalysisInput:
    goal: str
    analysis_locale: str
    planned_duration_minutes: int
    actual_duration_minutes: int
    metrics: SessionMetrics
    events: list[dict[str, Any]]


@dataclass(frozen=True)
class Rewards:
    xp: int
    focus: int
    stamina: int
    execution: int
    discipline: int


@dataclass(frozen=True)
class AnalysisResult:
    goal_completion: float | None
    focus_score: int
    deep_work_minutes: int
    context_switches: int
    main_bottleneck: str | None
    distractions: list[str]
    insights: list[str]
    next_session_advice: str | None
    rewards: Rewards
    model_name: str


class Analyzer(Protocol):
    async def analyze(
        self, session: FocusSession, events: Sequence[ActivityEvent]
    ) -> AnalysisResult: ...

    async def aclose(self) -> None: ...


def build_analysis_input(
    session: FocusSession,
    events: Sequence[ActivityEvent],
    *,
    max_events: int = 250,
    max_payload_chars: int = 300,
    max_event_json_chars: int = 16_000,
) -> AnalysisInput:
    ordered = sorted(events, key=lambda event: event.occurred_at)
    duration = _duration_minutes(session.started_at, session.ended_at)
    idle_minutes = _idle_minutes(ordered, session.ended_at)
    context_switches = _context_switches(ordered)
    deep_work = _deep_work_minutes(ordered, session.started_at, session.ended_at)
    sources = Counter(event.source for event in ordered if event.source)

    compact_events: list[dict[str, Any]] = []
    event_json_chars = 0
    for event in ordered[:max_events]:
        compact_event = {
            "id": str(event.id),
            "type": event.event_type.value,
            "occurred_at": event.occurred_at.isoformat(),
            "source": _truncate(event.source, 160),
            "payload": _compact_payload(event.payload, max_payload_chars),
        }
        compact_event_chars = len(
            json.dumps(compact_event, ensure_ascii=False, separators=(",", ":"))
        )
        if compact_events and event_json_chars + compact_event_chars > max_event_json_chars:
            break
        compact_events.append(compact_event)
        event_json_chars += compact_event_chars

    return AnalysisInput(
        goal=session.goal,
        analysis_locale=session.analysis_locale or "en",
        planned_duration_minutes=session.planned_duration_minutes,
        actual_duration_minutes=duration,
        metrics=SessionMetrics(
            duration_minutes=duration,
            active_minutes=max(0, duration - min(duration, idle_minutes)),
            deep_work_minutes=min(duration, deep_work),
            context_switches=context_switches,
            idle_minutes=min(duration, idle_minutes),
            idle_percent=round(min(duration, idle_minutes) / duration * 100) if duration else 0,
            top_sources=[
                {"source": source, "events": count} for source, count in sources.most_common(8)
            ],
        ),
        events=compact_events,
    )


def calculate_rewards(
    *, goal_completion: float | None, focus_score: int, deep_work_minutes: int
) -> Rewards:
    completion = goal_completion or 0
    xp = round(min(250, deep_work_minutes + completion * 0.6 + focus_score * 0.25))
    return Rewards(
        xp=max(0, xp),
        focus=2 if focus_score >= 80 else 1 if focus_score >= 60 else 0,
        stamina=2 if deep_work_minutes >= 90 else 1 if deep_work_minutes >= 45 else 0,
        execution=(
            3 if completion >= 90 else 2 if completion >= 70 else 1 if completion >= 40 else 0
        ),
        discipline=0,
    )


class BaselineSessionAnalyzer:
    """Deterministic local analyzer used only when AI is explicitly disabled."""

    async def analyze(
        self, session: FocusSession, events: Sequence[ActivityEvent]
    ) -> AnalysisResult:
        analysis_input = build_analysis_input(session, events)
        metrics = analysis_input.metrics
        focus_score = max(
            0,
            min(100, 100 - metrics.context_switches * 2 - metrics.idle_minutes),
        )
        rewards = calculate_rewards(
            goal_completion=None,
            focus_score=focus_score,
            deep_work_minutes=metrics.deep_work_minutes,
        )
        top_source = metrics.top_sources[0]["source"] if metrics.top_sources else "unknown"
        localized = (
            {
                "insight": f"最常使用的工作环境：{top_source}",
                "advice": "请在会话结束时记录目标是否已完成。",
            }
            if analysis_input.analysis_locale == "zh-CN"
            else {
                "insight": f"Most used context: {top_source}",
                "advice": "Record whether the goal was completed at the end of the session.",
            }
        )
        return AnalysisResult(
            goal_completion=None,
            focus_score=focus_score,
            deep_work_minutes=metrics.deep_work_minutes,
            context_switches=metrics.context_switches,
            main_bottleneck=None,
            distractions=[],
            insights=[localized["insight"]],
            next_session_advice=localized["advice"],
            rewards=rewards,
            model_name="baseline-v2",
        )

    async def aclose(self) -> None:
        return None


def _duration_minutes(started_at: datetime, ended_at: datetime | None) -> int:
    if not ended_at:
        return 0
    return max(0, round((ended_at - started_at).total_seconds() / 60))


def _idle_minutes(events: Sequence[ActivityEvent], ended_at: datetime | None) -> int:
    idle_started: datetime | None = None
    seconds = 0.0
    for event in events:
        if event.event_type == EventType.IDLE_START and idle_started is None:
            idle_started = event.occurred_at
        elif event.event_type == EventType.IDLE_END and idle_started is not None:
            seconds += max(0.0, (event.occurred_at - idle_started).total_seconds())
            idle_started = None
    if idle_started and ended_at:
        seconds += max(0.0, (ended_at - idle_started).total_seconds())
    return round(seconds / 60)


def _context_switches(events: Sequence[ActivityEvent]) -> int:
    # Window-focus events do not identify an application consistently across platforms.
    # App/browser focus events already capture actual context changes without counting
    # a window-title update inside the same app as a switch.
    relevant = {
        EventType.APP_FOCUS,
        EventType.URL_VISIT,
    }
    previous: str | None = None
    switches = 0
    for event in events:
        if event.event_type not in relevant or not event.source:
            continue
        if previous is not None and event.source != previous:
            switches += 1
        previous = event.source
    return switches


def _deep_work_minutes(
    events: Sequence[ActivityEvent], started_at: datetime, ended_at: datetime | None
) -> int:
    if not ended_at or ended_at <= started_at:
        return 0

    relevant = {
        EventType.APP_FOCUS,
        EventType.URL_VISIT,
        EventType.IDLE_START,
        EventType.IDLE_END,
    }
    timeline = [event for event in events if event.event_type in relevant]
    cursor = started_at
    idle = False
    source: str | None = None
    focused_seconds = 0.0

    for event in timeline:
        occurred_at = min(max(event.occurred_at, started_at), ended_at)
        interval = max(0.0, (occurred_at - cursor).total_seconds())
        if not idle and source and interval >= 10 * 60:
            focused_seconds += interval

        if event.event_type == EventType.IDLE_START:
            idle = True
        elif event.event_type == EventType.IDLE_END:
            idle = False
        elif event.source:
            source = event.source
        cursor = max(cursor, occurred_at)

    tail = max(0.0, (ended_at - cursor).total_seconds())
    if not idle and source and tail >= 10 * 60:
        focused_seconds += tail
    return round(focused_seconds / 60)


def _compact_payload(payload: dict[str, Any], max_chars: int) -> dict[str, Any]:
    compact: dict[str, Any] = {}
    remaining = max_chars
    for key, value in payload.items():
        if remaining <= 0 or len(compact) >= 8:
            break
        safe_key = str(key)[:80]
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe_value: Any = _safe_payload_value(safe_key, value, min(remaining, 160))
            compact[safe_key] = safe_value
            remaining -= len(safe_key) + len(str(safe_value))
    return compact


def _truncate(value: Any, limit: int) -> Any:
    if not isinstance(value, str) or len(value) <= limit:
        return value
    return f"{value[: max(0, limit - 1)]}…"


def _safe_payload_value(key: str, value: Any, limit: int) -> Any:
    if not isinstance(value, str):
        return value
    if key.lower() == "url":
        try:
            parts = urlsplit(value)
            value = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
        except ValueError:
            value = "invalid-url"
    if key.lower() == "executablepath":
        value = value.replace("\\", "/").rsplit("/", maxsplit=1)[-1]
    return _truncate(value, limit)
