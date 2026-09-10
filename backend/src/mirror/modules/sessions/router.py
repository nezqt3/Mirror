from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.core.errors import AnalysisErrorCode, ApiError, SessionErrorCode
from mirror.modules.reports.model import SessionReport
from mirror.modules.sessions.model import FocusSession, SessionStatus
from mirror.modules.sessions.schema import (
    CompletedReportSummary,
    FailedReportSummary,
    ProcessingReportSummary,
    SessionCreate,
    SessionFinish,
    SessionHistoryItem,
    SessionRead,
)
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
        raise ApiError(status.HTTP_409_CONFLICT, SessionErrorCode.ACTIVE_SESSION_EXISTS)
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


@router.get("/history", response_model=list[SessionHistoryItem])
async def list_session_history(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[SessionHistoryItem]:
    rows = (
        await db.execute(
            select(FocusSession, SessionReport)
            .outerjoin(SessionReport, SessionReport.session_id == FocusSession.id)
            .where(FocusSession.user_id == current_user.id)
            .order_by(FocusSession.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [_history_item(session, report) for session, report in rows]


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
        raise ApiError(status.HTTP_404_NOT_FOUND, SessionErrorCode.NO_ACTIVE_SESSION)
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
        raise ApiError(status.HTTP_404_NOT_FOUND, SessionErrorCode.SESSION_NOT_FOUND)
    return item


@router.post("/{session_id}/finish", response_model=SessionRead)
async def finish_session(
    session_id: UUID, payload: SessionFinish, db: DbSession, current_user: CurrentUser
) -> FocusSession:
    item = await get_owned_session(db, session_id, current_user.id)
    if not item:
        raise ApiError(status.HTTP_404_NOT_FOUND, SessionErrorCode.SESSION_NOT_FOUND)
    if item.status != SessionStatus.ACTIVE:
        raise ApiError(status.HTTP_409_CONFLICT, SessionErrorCode.SESSION_NOT_ACTIVE)
    now = datetime.now(UTC)
    item.ended_at = payload.ended_at or now
    if item.ended_at < item.started_at:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            SessionErrorCode.SESSION_END_BEFORE_START,
        )
    if item.ended_at > now + MAX_CLOCK_SKEW:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            SessionErrorCode.SESSION_END_TOO_FAR_FUTURE,
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
    "/{session_id}/analysis/retry",
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
        raise ApiError(status.HTTP_404_NOT_FOUND, SessionErrorCode.SESSION_NOT_FOUND)
    if item.status != SessionStatus.FAILED:
        raise ApiError(status.HTTP_409_CONFLICT, AnalysisErrorCode.ANALYSIS_NOT_RETRYABLE)
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
        item.analysis_error_code = AnalysisErrorCode.ANALYSIS_QUEUE_UNAVAILABLE.value
        item.analysis_error_message = "Session analysis could not be queued"
        await db.commit()
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            AnalysisErrorCode.ANALYSIS_QUEUE_UNAVAILABLE,
        ) from exc


def _history_item(
    session: FocusSession,
    report: SessionReport | None,
) -> SessionHistoryItem:
    summary: CompletedReportSummary | ProcessingReportSummary | FailedReportSummary | None
    if report is not None:
        summary = CompletedReportSummary(
            goal_completion=report.goal_completion,
            focus_score=report.focus_score,
            deep_work_minutes=report.deep_work_minutes,
            context_switches=report.context_switches,
        )
    elif session.status == SessionStatus.FAILED:
        error_code = next(
            (
                candidate
                for candidate in AnalysisErrorCode
                if candidate.value == session.analysis_error_code
            ),
            AnalysisErrorCode.ANALYSIS_FAILED,
        )
        summary = FailedReportSummary(error_code=error_code)
    elif session.status == SessionStatus.ACTIVE:
        summary = None
    else:
        summary = ProcessingReportSummary()

    return SessionHistoryItem(
        **SessionRead.model_validate(session).model_dump(),
        report_summary=summary,
    )
