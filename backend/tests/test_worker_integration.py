import asyncio
import os
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from mirror.core.config import get_settings
from mirror.modules.characters.model import Character
from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.reports.model import SessionReport
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.users.model import User
from mirror.services.analyzer import AnalysisResult, Rewards
from mirror.worker.tasks import _analyze_session, _apply_rewards

RUN_DB_INTEGRATION = os.getenv("RUN_DB_INTEGRATION") == "1"


@pytest.mark.skipif(not RUN_DB_INTEGRATION, reason="set RUN_DB_INTEGRATION=1")
@pytest.mark.asyncio
async def test_worker_persists_report_and_applies_rewards() -> None:
    engine = create_async_engine(get_settings().database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id = uuid4()
    session_id = uuid4()
    started_at = datetime.now(UTC) - timedelta(minutes=60)

    try:
        async with session_factory() as db:
            db.add(
                User(
                    id=user_id,
                    email=f"worker-test-{user_id}@example.com",
                    password_hash="not-used",
                    display_name="Worker Test",
                )
            )
            db.add(Character(user_id=user_id, name="Test Character"))
            db.add(
                FocusSession(
                    id=session_id,
                    user_id=user_id,
                    goal="Finish integration test",
                    planned_duration_minutes=60,
                    status=SessionStatus.PROCESSING,
                    started_at=started_at,
                    ended_at=started_at + timedelta(minutes=60),
                )
            )
            db.add(
                ActivityEvent(
                    session_id=session_id,
                    client_event_id=uuid4(),
                    event_type=EventType.APP_FOCUS,
                    occurred_at=started_at,
                    source="Editor",
                    payload={},
                )
            )
            await db.commit()

        await _analyze_session(session_id)

        async with session_factory() as db:
            report = await db.scalar(
                select(SessionReport).where(SessionReport.session_id == session_id)
            )
            session = await db.get(FocusSession, session_id)
            character = await db.scalar(select(Character).where(Character.user_id == user_id))
            assert report is not None
            assert report.model_name == "baseline-v2"
            assert report.rewards["xp"] >= 0
            assert session is not None and session.status == SessionStatus.COMPLETED
            assert character is not None and character.xp == report.rewards["xp"]
            assert report.rewards["discipline"] == 1
            assert character.current_streak == 1
            assert character.longest_streak == 1
    finally:
        async with session_factory() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
        await engine.dispose()


@pytest.mark.skipif(not RUN_DB_INTEGRATION, reason="set RUN_DB_INTEGRATION=1")
@pytest.mark.asyncio
async def test_concurrent_sessions_award_daily_discipline_once() -> None:
    engine = create_async_engine(get_settings().database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    user_id = uuid4()
    first_session_id = uuid4()
    second_session_id = uuid4()
    started_at = datetime.now(UTC) - timedelta(minutes=60)
    result = AnalysisResult(
        goal_completion=80,
        focus_score=80,
        deep_work_minutes=45,
        context_switches=1,
        main_bottleneck=None,
        distractions=[],
        insights=["test"],
        next_session_advice="test",
        rewards=Rewards(xp=10, focus=1, stamina=1, execution=1, discipline=0),
        model_name="test",
    )

    try:
        async with session_factory() as db:
            db.add(
                User(
                    id=user_id,
                    email=f"discipline-test-{user_id}@example.com",
                    password_hash="not-used",
                    display_name="Discipline Test",
                )
            )
            db.add(Character(user_id=user_id, name="Test Character"))
            db.add_all(
                [
                    FocusSession(
                        id=session_id,
                        user_id=user_id,
                        goal="Test daily discipline",
                        planned_duration_minutes=60,
                        status=SessionStatus.PROCESSING,
                        started_at=started_at,
                        ended_at=started_at + timedelta(minutes=60),
                    )
                    for session_id in (first_session_id, second_session_id)
                ]
            )
            await db.commit()

        async def apply(session_id: object) -> int:
            async with session_factory() as db:
                focus_session = await db.get(FocusSession, session_id)
                assert focus_session is not None
                applied = await _apply_rewards(db, focus_session, replace(result))
                await db.commit()
                return applied.discipline

        deltas = await asyncio.gather(apply(first_session_id), apply(second_session_id))

        assert sorted(deltas) == [0, 1]
        async with session_factory() as db:
            character = await db.scalar(select(Character).where(Character.user_id == user_id))
            assert character is not None
            assert character.discipline == 2
            assert character.current_streak == 1
    finally:
        async with session_factory() as db:
            await db.execute(delete(User).where(User.id == user_id))
            await db.commit()
        await engine.dispose()
