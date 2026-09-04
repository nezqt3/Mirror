"""Run the public HTTP pipeline with a strict raw-activity batch and print the report."""

import json
import os
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
from redis import Redis


def main() -> None:
    report = run_pipeline()
    print(json.dumps(report, ensure_ascii=False, indent=2))


def run_pipeline() -> dict[str, object]:
    base_url = os.getenv("MIRROR_API_URL", "http://localhost:8000/api/v1").rstrip("/")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    analysis_locale = os.getenv("MIRROR_ANALYSIS_LOCALE", "en")
    email = f"mirror.pipeline.{uuid4().hex[:12]}@gmail.com"
    password = "MirrorPipeline-2026!"

    with (
        httpx.Client(base_url=base_url, timeout=20) as client,
        Redis.from_url(redis_url, decode_responses=True) as redis_client,
    ):
        user = _post(
            client,
            "/users",
            {"email": email, "password": password, "display_name": "Pipeline Check"},
        )
        tokens = _post(client, "/auth/login", {"email": email, "password": password})
        client.headers["Authorization"] = f"Bearer {tokens['access_token']}"
        _post(client, "/character", {"name": "Pipeline Mirror", "avatar_key": None})
        session = _post(
            client,
            "/sessions",
            {
                "goal": "Закончить презентацию и экспортировать финальную версию",
                "planned_duration_minutes": 60,
                "client_timezone": "Asia/Shanghai",
                "analysis_locale": analysis_locale,
            },
        )
        if session["analysis_locale"] != analysis_locale:
            raise RuntimeError("session returned an unexpected analysis locale")
        active_key = f"active_session:{user['id']}"
        if redis_client.get(active_key) != session["id"]:
            raise RuntimeError("session ID was not written to Redis")

        current = _get(client, "/sessions/current")
        if current["id"] != session["id"]:
            raise RuntimeError("active-session lookup returned a different session")

        started_at = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
        batch = _raw_batch(session["id"], user["id"], started_at)
        accepted = _post(client, f"/sessions/{session['id']}/events:batch", batch)
        if accepted != {"accepted": len(batch["events"]), "duplicates": 0}:
            raise RuntimeError(f"unexpected ingest response: {accepted}")

        _post(
            client,
            f"/sessions/{session['id']}/finish",
            {"ended_at": _iso(started_at + timedelta(minutes=60))},
        )
        if redis_client.get(active_key) is not None:
            raise RuntimeError("active-session Redis key was not cleared after finish")
        report = _wait_for_report(client, session["id"])

    return report


def _raw_batch(session_id: str, user_id: str, start: datetime) -> dict[str, object]:
    producer_id = f"pipeline-{uuid4().hex[:8]}"
    specs = [
        (0, "session_start", {"goal": "Закончить презентацию", "plannedDurationSec": 3600}),
        (1, "app_focus", {"processId": 101, "appName": "Keynote"}),
        (12, "browser_navigation", _browser_data("market research")),
        (18, "browser_navigation", _browser_data("market statistics")),
        (24, "browser_navigation", _browser_data("market report source")),
        (36, "app_focus", {"processId": 101, "appName": "Keynote"}),
        (58, "window_focus", {"processId": 101, "title": "Presentation — slide 10"}),
        (60, "session_end", {"endReason": "completed"}),
    ]
    events = []
    for sequence, (minute, event_type, data) in enumerate(specs, start=1):
        events.append(
            {
                "schemaVersion": 1,
                "eventId": str(uuid4()),
                "sessionId": session_id,
                "userId": user_id,
                "producerId": producer_id,
                "producerSequence": sequence,
                "timestamp": _iso(start + timedelta(minutes=minute)),
                "monotonicMs": minute * 60_000,
                "platform": "macos",
                "source": "electron",
                "type": event_type,
                "data": data,
            }
        )
    return {
        "schemaVersion": 1,
        "sessionId": session_id,
        "sentAt": _iso(start + timedelta(minutes=60)),
        "events": events,
    }


def _browser_data(query: str) -> dict[str, object]:
    return {
        "browser": "Chrome",
        "url": f"https://www.google.com/search?q={query.replace(' ', '+')}",
        "domain": "google.com",
        "title": query,
        "incognito": False,
        "transition": "typed",
    }


def _wait_for_report(client: httpx.Client, session_id: str) -> dict[str, object]:
    for _ in range(60):
        report = _get(client, f"/sessions/{session_id}/report")
        if report["status"] != "processing":
            return report
        time.sleep(1)
    raise TimeoutError("report was not completed within 60 seconds")


def _post(client: httpx.Client, path: str, payload: object) -> dict[str, object]:
    response = client.post(path, json=payload)
    response.raise_for_status()
    return response.json()


def _get(client: httpx.Client, path: str) -> dict[str, object]:
    response = client.get(path)
    response.raise_for_status()
    return response.json()


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    main()
