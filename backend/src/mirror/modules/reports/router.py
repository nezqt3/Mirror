from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.reports.model import SessionReport
from mirror.modules.reports.schema import ReportRead
from mirror.modules.sessions.service import get_owned_session

router = APIRouter(prefix="/sessions", tags=["reports"])


@router.get("/{session_id}/report", response_model=ReportRead)
async def read_report(session_id: UUID, db: DbSession, current_user: CurrentUser) -> SessionReport:
    if not await get_owned_session(db, session_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    report = await db.scalar(select(SessionReport).where(SessionReport.session_id == session_id))
    if not report:
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED, detail="Report is still processing"
        )
    return report
