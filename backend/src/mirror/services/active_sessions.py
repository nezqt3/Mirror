from __future__ import annotations

from uuid import UUID

import structlog
from redis.asyncio import Redis
from redis.exceptions import RedisError

from mirror.core.config import get_settings

logger = structlog.get_logger(__name__)
_client: Redis | None = None


def active_session_key(user_id: UUID) -> str:
    return f"active_session:{user_id}"


async def get_active_session_id(user_id: UUID) -> UUID | None:
    try:
        value = await _redis().get(active_session_key(user_id))
        if value is None:
            return None
        return UUID(value.decode() if isinstance(value, bytes) else value)
    except (RedisError, ValueError, TypeError):
        logger.warning("active_session_cache_read_failed", user_id=str(user_id))
        return None


async def set_active_session_id(
    user_id: UUID,
    session_id: UUID,
    *,
    planned_duration_minutes: int,
) -> None:
    ttl_seconds = planned_duration_minutes * 60 + 60 * 60
    try:
        await _redis().set(active_session_key(user_id), str(session_id), ex=ttl_seconds)
    except RedisError:
        logger.warning("active_session_cache_write_failed", user_id=str(user_id))


async def clear_active_session_id(user_id: UUID) -> None:
    try:
        await _redis().delete(active_session_key(user_id))
    except RedisError:
        logger.warning("active_session_cache_delete_failed", user_id=str(user_id))


async def close_active_session_cache() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client
