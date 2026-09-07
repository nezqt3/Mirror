import json
import os
import subprocess
import sys
from uuid import uuid4

import httpx
import pytest

RUN_API_INTEGRATION = os.getenv("RUN_API_INTEGRATION") == "1"


@pytest.mark.skipif(not RUN_API_INTEGRATION, reason="set RUN_API_INTEGRATION=1")
def test_real_authenticated_api_pipeline() -> None:
    completed = subprocess.run(
        [sys.executable, "scripts/check_pipeline.py"],
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(completed.stdout)

    assert report["status"] == "completed"
    assert isinstance(report["focus_score"], int)
    assert isinstance(report["rewards"], dict)
    assert "discipline" in report["rewards"]


@pytest.mark.skipif(not RUN_API_INTEGRATION, reason="set RUN_API_INTEGRATION=1")
def test_real_refresh_rotation_and_logout() -> None:
    email = f"mirror.auth.{uuid4().hex[:12]}@example.com"
    password = "MirrorAuth-2026!"
    with httpx.Client(base_url="http://localhost:8000/api/v1", timeout=20) as client:
        register = client.post(
            "/users",
            json={"email": email, "password": password, "display_name": "Auth Check"},
        )
        assert register.status_code == 201
        login = client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        original = login.json()

        refresh = client.post(
            "/auth/refresh",
            json={"refresh_token": original["refresh_token"]},
        )
        assert refresh.status_code == 200
        rotated = refresh.json()
        assert rotated["refresh_token"] != original["refresh_token"]
        assert client.post(
            "/auth/refresh",
            json={"refresh_token": original["refresh_token"]},
        ).status_code == 401
        assert client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {rotated['access_token']}"},
        ).status_code == 200

        assert client.post(
            "/auth/logout",
            json={"refresh_token": rotated["refresh_token"]},
        ).status_code == 204
        assert client.post(
            "/auth/refresh",
            json={"refresh_token": rotated["refresh_token"]},
        ).status_code == 401
