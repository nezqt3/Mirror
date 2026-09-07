from uuid import UUID

from fastapi import APIRouter, Response, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.core.errors import AnalysisErrorCode, ApiError, SessionErrorCode
from mirror.modules.reports.model import SessionReport
from mirror.modules.reports.schema import ReportFailed, ReportPending, ReportRead, ReportResponse
from mirror.modules.sessions.model import SessionStatus
from mirror.modules.sessions.service import get_owned_session

router = APIRouter(prefix="/sessions", tags=["reports"])


@router.get("/{session_id}/report", response_model=ReportResponse)
async def read_report(
    session_id: UUID,
    response: Response,
    db: DbSession,
    current_user: CurrentUser,
) -> ReportResponse:
    session = await get_owned_session(db, session_id, current_user.id)
    if not session:
        raise ApiError(status.HTTP_404_NOT_FOUND, SessionErrorCode.SESSION_NOT_FOUND)
    report = await db.scalar(select(SessionReport).where(SessionReport.session_id == session_id))
    if report:
        return ReportRead.model_validate(report)
    if session.status == SessionStatus.FAILED:
        return ReportFailed(
            session_id=session.id,
            error_code=session.analysis_error_code or AnalysisErrorCode.ANALYSIS_FAILED,
        )
    response.status_code = status.HTTP_202_ACCEPTED
    return ReportPending(session_id=session.id)
