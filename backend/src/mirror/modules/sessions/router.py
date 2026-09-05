from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.sessions.schema import SessionCreate, SessionFinish, SessionRead
from mirror.modules.sessions.service import get_owned_session
from mirror.services.active_sessions import (
    clear_active_session_id,
    get_active_session_id,
    set_active_session_id,
)
from mirror.worker.tasks import analyze_session

router = APIRouter(prefix="/sessions", tags=["sessions"])
MAX_CLOCK_SKEW = timedelta(minutes=5)


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate, db: DbSession, current_user: CurrentUser
) -> FocusSession:
    active = await db.scalar(
        select(FocusSession.id).where(
            FocusSession.user_id == current_user.id,
            FocusSession.status == SessionStatus.ACTIVE,
        )
    )
    if active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Active session exists")
    item = FocusSession(
        user_id=current_user.id,
        started_at=datetime.now(UTC),
        **payload.model_dump(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await set_active_session_id(
        current_user.id,
        item.id,
        planned_duration_minutes=item.planned_duration_minutes,
    )
    return item


@router.get("", response_model=list[SessionRead])
async def list_sessions(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[FocusSession]:
    result = await db.scalars(
        select(FocusSession)
        .where(FocusSession.user_id == current_user.id)
        .order_by(FocusSession.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result)


@router.get("/current", response_model=SessionRead)
async def read_current_session(
    db: DbSession,
    current_user: CurrentUser,
) -> FocusSession:
    cached_id = await get_active_session_id(current_user.id)
    if cached_id is not None:
        cached = await get_owned_session(db, cached_id, current_user.id)
        if cached is not None and cached.status == SessionStatus.ACTIVE:
            return cached
        await clear_active_session_id(current_user.id)

    item = await db.scalar(
        select(FocusSession).where(
            FocusSession.user_id == current_user.id,
            FocusSession.status == SessionStatus.ACTIVE,
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session")
    await set_active_session_id(
        current_user.id,
        item.id,
        planned_duration_minutes=item.planned_duration_minutes,
    )
    return item


@router.get("/{session_id}", response_model=SessionRead)
async def read_session(session_id: UUID, db: DbSession, current_user: CurrentUser) -> FocusSession:
    item = await get_owned_session(db, session_id, current_user.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return item


@router.post("/{session_id}/finish", response_model=SessionRead)
async def finish_session(
    session_id: UUID, payload: SessionFinish, db: DbSession, current_user: CurrentUser
) -> FocusSession:
    item = await get_owned_session(db, session_id, current_user.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if item.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")
    now = datetime.now(UTC)
    item.ended_at = payload.ended_at or now
    if item.ended_at < item.started_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session end time cannot be before start time",
        )
    if item.ended_at > now + MAX_CLOCK_SKEW:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session end time is too far in the future",
        )
    item.status = SessionStatus.PROCESSING
    item.analysis_error_code = None
    item.analysis_error_message = None
    await db.commit()
    await db.refresh(item)
    await clear_active_session_id(current_user.id)
    await _enqueue_analysis(item, db)
    return item


@router.post(
    "/{session_id}/analysis:retry",
    response_model=SessionRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def retry_session_analysis(
    session_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> FocusSession:
    item = await get_owned_session(db, session_id, current_user.id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if item.status != SessionStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only failed analysis can be retried",
        )
    item.status = SessionStatus.PROCESSING
    item.analysis_error_code = None
    item.analysis_error_message = None
    await db.commit()
    await db.refresh(item)
    await _enqueue_analysis(item, db)
    return item


async def _enqueue_analysis(item: FocusSession, db: DbSession) -> None:
    try:
        analyze_session.delay(str(item.id))
    except Exception as exc:
        item.status = SessionStatus.FAILED
        item.analysis_error_code = "ANALYSIS_QUEUE_UNAVAILABLE"
        item.analysis_error_message = "Session analysis could not be queued"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis queue is temporarily unavailable; retry the analysis later",
        ) from exc
