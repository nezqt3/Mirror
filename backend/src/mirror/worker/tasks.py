import asyncio
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from mirror.core.config import get_settings
from mirror.db import models as _models  # noqa: F401
from mirror.modules.events.model import ActivityEvent
from mirror.modules.reports.model import SessionReport
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.services.analyzer import SessionAnalyzer
from mirror.worker.celery_app import celery_app


@celery_app.task(  # type: ignore[untyped-decorator]
    name="mirror.analyze_session",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def analyze_session(session_id: str) -> None:
    asyncio.run(_analyze_session(UUID(session_id)))


async def _analyze_session(session_id: UUID) -> None:
    worker_engine = create_async_engine(
        get_settings().database_url,
        poolclass=NullPool,
        echo=get_settings().debug,
    )
    worker_session = async_sessionmaker(worker_engine, expire_on_commit=False)
    try:
        async with worker_session() as db:
            session = await db.get(FocusSession, session_id)
            if not session or session.status == SessionStatus.COMPLETED:
                return
            events = list(
                await db.scalars(
                    select(ActivityEvent)
                    .where(ActivityEvent.session_id == session_id)
                    .order_by(ActivityEvent.occurred_at)
                )
            )
            result = SessionAnalyzer().analyze(session, events)
            report = SessionReport(session_id=session.id, **result.__dict__)
            db.add(report)
            session.status = SessionStatus.COMPLETED
            await db.commit()
    finally:
        await worker_engine.dispose()
