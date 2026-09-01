from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mirror.modules.sessions.model import FocusSession


async def get_owned_session(
    db: AsyncSession, session_id: UUID, user_id: UUID
) -> FocusSession | None:
    result = await db.execute(
        select(FocusSession).where(FocusSession.id == session_id, FocusSession.user_id == user_id)
    )
    return result.scalar_one_or_none()
