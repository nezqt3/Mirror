import asyncio
from dataclasses import asdict
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from mirror.core.config import get_settings
from mirror.db import models as _models  # noqa: F401
from mirror.modules.characters.model import Character
from mirror.modules.events.model import ActivityEvent
from mirror.modules.reports.model import SessionReport
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.services.analyzer import AnalysisResult, Analyzer
from mirror.services.analyzer_factory import create_analyzer
from mirror.services.groq_analyzer import PermanentAnalyzerError
from mirror.worker.celery_app import celery_app

logger = structlog.get_logger(__name__)
MAX_RETRIES = 3


@celery_app.task(  # type: ignore[untyped-decorator]
    bind=True,
    name="mirror.analyze_session",
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def analyze_session(task: Any, session_id: str) -> None:
    try:
        asyncio.run(_analyze_session(UUID(session_id)))
    except PermanentAnalyzerError as exc:
        asyncio.run(_mark_failed(UUID(session_id), "AI_CONFIGURATION_ERROR"))
        logger.error("session_analysis_permanent_failure", session_id=session_id, error=str(exc))
        raise
    except Exception as exc:
        if task.request.retries >= MAX_RETRIES:
            asyncio.run(_mark_failed(UUID(session_id), "AI_PROVIDER_UNAVAILABLE"))
            logger.error("session_analysis_retries_exhausted", session_id=session_id)
            raise
        countdown = min(60, 2 ** (task.request.retries + 1))
        raise task.retry(exc=exc, countdown=countdown) from exc


async def _analyze_session(session_id: UUID) -> None:
    settings = get_settings()
    worker_engine = create_async_engine(
        settings.database_url,
        poolclass=NullPool,
        echo=settings.debug,
    )
    worker_session = async_sessionmaker(worker_engine, expire_on_commit=False)
    analyzer: Analyzer | None = None
    try:
        analyzer = create_analyzer(settings)
        async with worker_session() as db:
            session = await db.get(FocusSession, session_id)
            if not session or session.status == SessionStatus.COMPLETED:
                return
            if await _report_exists(db, session_id):
                session.status = SessionStatus.COMPLETED
                await db.commit()
                return

            events = list(
                await db.scalars(
                    select(ActivityEvent)
                    .where(ActivityEvent.session_id == session_id)
                    .order_by(ActivityEvent.occurred_at)
                )
            )
            result = await analyzer.analyze(session, events)

            if await _report_exists(db, session_id):
                session.status = SessionStatus.COMPLETED
                await db.commit()
                return

            report = SessionReport(
                session_id=session.id,
                goal_completion=result.goal_completion,
                focus_score=result.focus_score,
                deep_work_minutes=result.deep_work_minutes,
                context_switches=result.context_switches,
                main_bottleneck=result.main_bottleneck,
                distractions=result.distractions,
                insights=result.insights,
                next_session_advice=result.next_session_advice,
                rewards=asdict(result.rewards),
                model_name=result.model_name,
            )
            db.add(report)
            await _apply_rewards(db, session.user_id, result)
            session.status = SessionStatus.COMPLETED
            session.analysis_error_code = None
            session.analysis_error_message = None
            await db.commit()
    finally:
        if analyzer is not None:
            await analyzer.aclose()
        await worker_engine.dispose()


async def _report_exists(db: AsyncSession, session_id: UUID) -> bool:
    report_id = await db.scalar(
        select(SessionReport.id).where(SessionReport.session_id == session_id)
    )
    return report_id is not None


async def _apply_rewards(db: AsyncSession, user_id: UUID, result: AnalysisResult) -> None:
    character = await db.scalar(select(Character).where(Character.user_id == user_id))
    if not character:
        return
    character.xp += result.rewards.xp
    character.focus += result.rewards.focus
    character.stamina += result.rewards.stamina
    character.execution += result.rewards.execution
    while character.xp >= character.level * 500:
        character.xp -= character.level * 500
        character.level += 1


async def _mark_failed(session_id: UUID, error_code: str) -> None:
    settings = get_settings()
    worker_engine = create_async_engine(settings.database_url, poolclass=NullPool)
    worker_session = async_sessionmaker(worker_engine, expire_on_commit=False)
    try:
        async with worker_session() as db:
            session = await db.get(FocusSession, session_id)
            if not session or session.status == SessionStatus.COMPLETED:
                return
            session.status = SessionStatus.FAILED
            session.analysis_error_code = error_code
            session.analysis_error_message = "Session analysis could not be completed"
            await db.commit()
    finally:
        await worker_engine.dispose()
