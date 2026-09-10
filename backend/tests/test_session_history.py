import os
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from mirror.core.config import get_settings
from mirror.core.errors import AnalysisErrorCode
from mirror.modules.reports.model import SessionReport
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.sessions.router import list_session_history
from mirror.modules.users.model import User

RUN_DB_INTEGRATION = os.getenv("RUN_DB_INTEGRATION") == "1"


@pytest.mark.asyncio
async def test_history_builds_all_report_states_with_one_database_call() -> None:
    user_id = uuid4()
    now = datetime.now(UTC)
    completed = _session(user_id, SessionStatus.COMPLETED, now)
    processing = _session(user_id, SessionStatus.PROCESSING, now - timedelta(minutes=1))
    failed = _session(user_id, SessionStatus.FAILED, now - timedelta(minutes=2))
    failed.analysis_error_code = "unknown-old-code"
    active = _session(user_id, SessionStatus.ACTIVE, now - timedelta(minutes=3))
    report = SessionReport(
        session_id=completed.id,
        goal_completion=75,
        focus_score=82,
        deep_work_minutes=48,
        context_switches=5,
        main_bottleneck=None,
        distractions=[],
        insights=[],
        next_session_advice=None,
        rewards={},
        model_name="test",
    )
    result = Mock()
    result.all.return_value = [
        (completed, report),
        (processing, None),
        (failed, None),
        (active, None),
    ]
    db = AsyncMock()
    db.execute.return_value = result

    history = await list_session_history(
        db=db,
        current_user=SimpleNamespace(id=user_id),
        limit=100,
        offset=0,
    )

    db.execute.assert_awaited_once()
    assert history[0].report_summary is not None
    assert history[0].report_summary.model_dump() == {
        "status": "completed",
        "goal_completion": 75.0,
        "focus_score": 82,
        "deep_work_minutes": 48,
        "context_switches": 5,
    }
    assert history[1].report_summary is not None
    assert history[1].report_summary.status == "processing"
    assert history[2].report_summary is not None
    assert history[2].report_summary.status == "failed"
    assert history[2].report_summary.error_code == AnalysisErrorCode.ANALYSIS_FAILED
    assert history[3].report_summary is None


@pytest.mark.skipif(not RUN_DB_INTEGRATION, reason="set RUN_DB_INTEGRATION=1")
@pytest.mark.asyncio
async def test_history_filters_by_owner_and_applies_pagination() -> None:
    engine = create_async_engine(get_settings().database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    owner = User(
        id=uuid4(),
        email=f"history-owner-{uuid4()}@example.com",
        password_hash="not-used",
        display_name="History Owner",
    )
    other = User(
        id=uuid4(),
        email=f"history-other-{uuid4()}@example.com",
        password_hash="not-used",
        display_name="History Other",
    )
    now = datetime.now(UTC)
    newest = _session(owner.id, SessionStatus.PROCESSING, now)
    older = _session(owner.id, SessionStatus.ACTIVE, now - timedelta(minutes=1))
    foreign = _session(other.id, SessionStatus.PROCESSING, now + timedelta(minutes=1))

    try:
        async with session_factory() as db:
            db.add_all([owner, other, newest, older, foreign])
            await db.commit()

            first_page = await list_session_history(
                db=db,
                current_user=owner,
                limit=1,
                offset=0,
            )
            second_page = await list_session_history(
                db=db,
                current_user=owner,
                limit=1,
                offset=1,
            )

        assert [item.id for item in first_page] == [newest.id]
        assert [item.id for item in second_page] == [older.id]
        assert all(item.id != foreign.id for item in first_page + second_page)
    finally:
        async with session_factory() as db:
            await db.execute(delete(User).where(User.id.in_([owner.id, other.id])))
            await db.commit()
        await engine.dispose()


def _session(
    user_id: object,
    status: SessionStatus,
    started_at: datetime,
) -> FocusSession:
    return FocusSession(
        id=uuid4(),
        user_id=user_id,
        goal="Test session history",
        planned_duration_minutes=60,
        analysis_locale="en",
        status=status,
        client_timezone="UTC",
        started_at=started_at,
        created_at=started_at,
    )
