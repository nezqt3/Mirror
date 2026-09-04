from typing import Any
from uuid import uuid4

import pytest

from mirror.services import active_sessions


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.expirations: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self.values.get(key)

    async def set(self, key: str, value: str, *, ex: int) -> None:
        self.values[key] = value
        self.expirations[key] = ex

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_active_session_pointer_lifecycle(monkeypatch: pytest.MonkeyPatch) -> None:
    fake: Any = FakeRedis()
    monkeypatch.setattr(active_sessions, "_client", fake)
    user_id = uuid4()
    session_id = uuid4()

    await active_sessions.set_active_session_id(
        user_id,
        session_id,
        planned_duration_minutes=60,
    )

    key = active_sessions.active_session_key(user_id)
    assert await active_sessions.get_active_session_id(user_id) == session_id
    assert fake.expirations[key] == 7200

    await active_sessions.clear_active_session_id(user_id)
    assert await active_sessions.get_active_session_id(user_id) is None
