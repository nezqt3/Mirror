from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.sessions.schema import SessionCreate, SessionFinish, SessionRead
from mirror.modules.sessions.service import get_owned_session
from mirror.worker.tasks import analyze_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


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
    item.ended_at = payload.ended_at or datetime.now(UTC)
    if item.ended_at < item.started_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session end time cannot be before start time",
        )
    item.status = SessionStatus.PROCESSING
    item.analysis_error_code = None
    item.analysis_error_message = None
    await db.commit()
    await db.refresh(item)
    analyze_session.delay(str(item.id))
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
    analyze_session.delay(str(item.id))
    return item
