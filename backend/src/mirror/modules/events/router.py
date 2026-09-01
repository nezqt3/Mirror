from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.events.model import ActivityEvent
from mirror.modules.events.schema import EventBatchAccepted, EventBatchCreate
from mirror.modules.sessions.model import SessionStatus
from mirror.modules.sessions.service import get_owned_session

router = APIRouter(prefix="/sessions", tags=["events"])


@router.post(
    "/{session_id}/events:batch",
    response_model=EventBatchAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_events(
    session_id: UUID,
    payload: EventBatchCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> EventBatchAccepted:
    session = await get_owned_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")
    db.add_all(
        [ActivityEvent(session_id=session.id, **event.model_dump()) for event in payload.events]
    )
    await db.commit()
    return EventBatchAccepted(accepted=len(payload.events))
