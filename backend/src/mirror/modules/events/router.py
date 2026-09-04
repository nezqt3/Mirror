from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.dialects.postgresql import insert

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
    rows = [
        {"session_id": session.id, **event.model_dump()}
        for event in payload.events
    ]
    result = await db.execute(
        insert(ActivityEvent)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["session_id", "client_event_id"])
        .returning(ActivityEvent.id)
    )
    await db.commit()
    accepted = len(list(result.scalars()))
    return EventBatchAccepted(accepted=accepted, duplicates=len(payload.events) - accepted)
