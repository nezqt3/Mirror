from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from mirror.modules.events.model import EventType
from mirror.modules.events.raw_schema import RawEventBatchCreate
from mirror.modules.events.router import _raw_event_row, _validate_raw_batch

SESSION_ID = UUID("6d994566-e187-4944-b223-143566d5f74c")
USER_ID = UUID("d4fb0729-6ee0-447f-af9c-ebed9c852370")
EXAMPLE_PATH = Path(__file__).parents[1] / "examples" / "raw-event-batch.json"


def test_raw_event_batch_matches_typescript_contract() -> None:
    payload = RawEventBatchCreate.model_validate(_batch())

    assert payload.schema_version == 1
    assert payload.sent_at == datetime(2026, 9, 4, 14, 0, tzinfo=UTC)
    assert len(payload.events) == 2

    row = _raw_event_row(payload.events[1])
    assert row["event_type"] == EventType.URL_VISIT
    assert row["source"] == "Chrome"
    assert row["payload"]["domain"] == "docs.groq.com"


def test_swagger_example_is_kept_valid() -> None:
    payload = RawEventBatchCreate.model_validate_json(EXAMPLE_PATH.read_text())

    assert payload.session_id == SESSION_ID
    assert len(payload.events) == 2


def test_raw_batch_rejects_wrong_session_or_user() -> None:
    payload = RawEventBatchCreate.model_validate(_batch())

    with pytest.raises(HTTPException, match="sessionId"):
        _validate_raw_batch(payload, UUID(int=1), USER_ID)

    with pytest.raises(HTTPException) as exc_info:
        _validate_raw_batch(payload, SESSION_ID, UUID(int=1))
    assert exc_info.value.status_code == 403


def test_raw_batch_rejects_incognito_and_unknown_fields() -> None:
    incognito = _batch()
    incognito["events"][1]["data"]["incognito"] = True
    with pytest.raises(ValidationError, match="incognito activity"):
        RawEventBatchCreate.model_validate(incognito)

    unknown = _batch()
    unknown["events"][0]["secret"] = "must-not-pass"
    with pytest.raises(ValidationError, match="extra_forbidden"):
        RawEventBatchCreate.model_validate(unknown)


def test_raw_batch_rejects_naive_timestamps_and_duplicate_sequence() -> None:
    naive = _batch()
    naive["sentAt"] = "2026-09-04T14:00:00"
    with pytest.raises(ValidationError, match="timezone"):
        RawEventBatchCreate.model_validate(naive)

    duplicate = _batch()
    duplicate["events"][1]["producerSequence"] = 1
    with pytest.raises(ValidationError, match="producerSequence"):
        RawEventBatchCreate.model_validate(duplicate)


def _batch() -> dict[str, object]:
    common = {
        "schemaVersion": 1,
        "sessionId": str(SESSION_ID),
        "userId": str(USER_ID),
        "producerId": "desktop-main-1",
        "platform": "macos",
        "source": "electron",
    }
    return {
        "schemaVersion": 1,
        "sessionId": str(SESSION_ID),
        "sentAt": "2026-09-04T14:00:00Z",
        "events": [
            {
                **common,
                "eventId": "9740bd4a-8174-4c62-89e8-45bda1dedc01",
                "producerSequence": 1,
                "timestamp": "2026-09-04T13:00:00Z",
                "monotonicMs": 1000,
                "type": "app_focus",
                "data": {"processId": 42, "appName": "Keynote"},
            },
            {
                **common,
                "eventId": "9740bd4a-8174-4c62-89e8-45bda1dedc02",
                "producerSequence": 2,
                "timestamp": "2026-09-04T13:10:00Z",
                "monotonicMs": 601000,
                "type": "browser_navigation",
                "data": {
                    "browser": "Chrome",
                    "url": "https://docs.groq.com/reasoning?token=private",
                    "domain": "docs.groq.com",
                    "title": "Groq reasoning docs",
                    "incognito": False,
                    "transition": "typed",
                },
            },
        ],
    }
