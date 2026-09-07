from fastapi.testclient import TestClient

from mirror.core.errors import (
    AnalysisErrorCode,
    AuthErrorCode,
    CharacterErrorCode,
    CommonErrorCode,
    EventErrorCode,
    SessionErrorCode,
    UserErrorCode,
)
from mirror.main import app

ERROR_ENUMS = (
    CommonErrorCode,
    AuthErrorCode,
    UserErrorCode,
    CharacterErrorCode,
    SessionErrorCode,
    AnalysisErrorCode,
    EventErrorCode,
)


def test_error_codes_are_unique_and_have_developer_messages() -> None:
    members = [member for enum_type in ERROR_ENUMS for member in enum_type]

    assert len({member.value for member in members}) == len(members)
    assert all(member.message for member in members)


def test_validation_errors_have_stable_codes_and_safe_details() -> None:
    response = TestClient(app).post("/api/v1/auth/login", json={})

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": CommonErrorCode.VALIDATION_ERROR,
            "message": "Request validation failed",
            "details": {
                "issues": [
                    {"field": "email", "type": "missing"},
                    {"field": "password", "type": "missing"},
                ]
            },
        }
    }


def test_framework_http_errors_are_normalized() -> None:
    response = TestClient(app).get("/api/v1/not-a-route")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": CommonErrorCode.RESOURCE_NOT_FOUND,
            "message": "Requested resource was not found",
            "details": {},
        }
    }


def test_authentication_errors_expose_only_a_code() -> None:
    response = TestClient(app).get("/api/v1/users/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {
        "error": {
            "code": AuthErrorCode.AUTHENTICATION_REQUIRED,
            "message": "Authentication is required",
            "details": {},
        }
    }
