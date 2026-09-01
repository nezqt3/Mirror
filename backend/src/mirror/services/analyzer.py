from collections import Counter
from dataclasses import dataclass
from typing import Any

from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.sessions.model import FocusSession


@dataclass(frozen=True)
class AnalysisResult:
    goal_completion: float
    focus_score: int
    deep_work_minutes: int
    context_switches: int
    bottlenecks: list[dict[str, Any]]
    distractions: list[dict[str, Any]]
    insights: list[str]
    next_session_advice: str
    model_name: str


class SessionAnalyzer:
    """Deterministic baseline; replace behind this interface with a multimodal provider."""

    def analyze(self, session: FocusSession, events: list[ActivityEvent]) -> AnalysisResult:
        switches = sum(event.event_type == EventType.APP_FOCUS for event in events)
        idle_periods = sum(event.event_type == EventType.IDLE_START for event in events)
        sources = Counter(event.source for event in events if event.source)
        duration = 0
        if session.ended_at:
            duration = max(0, int((session.ended_at - session.started_at).total_seconds() / 60))
        focus_score = max(0, min(100, 100 - switches * 2 - idle_periods * 5))
        deep_work = max(0, duration - switches - idle_periods * 5)
        top_source = sources.most_common(1)[0][0] if sources else "unknown"
        return AnalysisResult(
            goal_completion=0.0,
            focus_score=focus_score,
            deep_work_minutes=deep_work,
            context_switches=switches,
            bottlenecks=[],
            distractions=[],
            insights=[f"Most used context: {top_source}"],
            next_session_advice=(
                "At the end of the next session, record goal completion explicitly."
            ),
            model_name="baseline-v1",
        )
