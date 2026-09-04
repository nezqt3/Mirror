from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.sessions.router import _enqueue_analysis, analyze_session


@pytest.mark.asyncio
async def test_enqueue_failure_marks_session_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        analyze_session,
        "delay",
        Mock(side_effect=RuntimeError("redis unavailable")),
    )
    db = AsyncMock()
    item = FocusSession(
        id=uuid4(),
        user_id=uuid4(),
        goal="Test queue failure",
        planned_duration_minutes=60,
        status=SessionStatus.PROCESSING,
        client_timezone="UTC",
        started_at=datetime.now(UTC),
    )

    with pytest.raises(HTTPException) as exc_info:
        await _enqueue_analysis(item, db)

    assert exc_info.value.status_code == 503
    assert item.status == SessionStatus.FAILED
    assert item.analysis_error_code == "ANALYSIS_QUEUE_UNAVAILABLE"
    db.commit.assert_awaited_once()
