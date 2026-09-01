from fastapi.testclient import TestClient

from mirror.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "mirror-api"}


def test_openapi_contains_mvp_endpoints() -> None:
    with TestClient(app) as client:
        paths = client.get("/openapi.json").json()["paths"]

    assert "/api/v1/sessions" in paths
    assert "/api/v1/sessions/{session_id}/events:batch" in paths
    assert "/api/v1/sessions/{session_id}/report" in paths
