from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.dialects.postgresql import insert

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.events.model import ActivityEvent, EventType
from mirror.modules.events.raw_schema import RawActivityEvent, RawEventBatchCreate
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
    payload: EventBatchCreate | RawEventBatchCreate,
    db: DbSession,
    current_user: CurrentUser,
) -> EventBatchAccepted:
    session = await get_owned_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status != SessionStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")
    if isinstance(payload, RawEventBatchCreate):
        _validate_raw_batch(payload, session_id, current_user.id)
        rows = [_raw_event_row(event) for event in payload.events]
    else:
        rows = [{"session_id": session.id, **event.model_dump()} for event in payload.events]
    result = await db.execute(
        insert(ActivityEvent)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["session_id", "client_event_id"])
        .returning(ActivityEvent.id)
    )
    await db.commit()
    accepted = len(list(result.scalars()))
    return EventBatchAccepted(accepted=accepted, duplicates=len(payload.events) - accepted)


def _validate_raw_batch(payload: RawEventBatchCreate, session_id: UUID, user_id: UUID) -> None:
    if payload.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Batch sessionId must match the session ID in the URL",
        )
    for event in payload.events:
        if event.session_id != session_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Event {event.event_id} has a different sessionId",
            )
        if event.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Event {event.event_id} does not belong to the authenticated user",
            )


def _raw_event_row(event: RawActivityEvent) -> dict[str, Any]:
    data = event.data.model_dump(by_alias=True, exclude_none=True)
    payload = {
        **data,
        "platform": event.platform.value,
        "producerId": event.producer_id,
        "producerSequence": event.producer_sequence,
        "monotonicMs": event.monotonic_ms,
        "captureSource": event.source.value,
    }
    type_mapping = {
        "browser_navigation": EventType.URL_VISIT,
        "session_start": EventType.SESSION_START,
        "session_end": EventType.SESSION_END,
        "app_focus": EventType.APP_FOCUS,
        "window_focus": EventType.WINDOW_FOCUS,
        "idle_start": EventType.IDLE_START,
        "idle_end": EventType.IDLE_END,
        "input_activity": EventType.INPUT_ACTIVITY,
        "screenshot": EventType.SCREENSHOT,
        "heartbeat": EventType.HEARTBEAT,
    }
    return {
        "session_id": event.session_id,
        "client_event_id": event.event_id,
        "event_type": type_mapping[event.type],
        "occurred_at": event.timestamp,
        "source": _event_context(event, data),
        "payload": payload,
    }


def _event_context(event: RawActivityEvent, data: dict[str, Any]) -> str:
    if event.type == "app_focus":
        return str(data["appName"])
    if event.type == "browser_navigation":
        return str(data["browser"])
    if event.type == "window_focus":
        return f"process:{data['processId']}"
    return event.type
