import logging
from enum import StrEnum
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorCode(StrEnum):
    message: str

    def __new__(cls, code: str, message: str) -> "ErrorCode":
        member = str.__new__(cls, code)
        member._value_ = code
        member.message = message
        return member


class CommonErrorCode(ErrorCode):
    VALIDATION_ERROR = ("VALIDATION_ERROR", "Request validation failed")
    BAD_REQUEST = ("BAD_REQUEST", "Request is invalid")
    FORBIDDEN = ("FORBIDDEN", "Operation is not permitted")
    RESOURCE_NOT_FOUND = ("RESOURCE_NOT_FOUND", "Requested resource was not found")
    METHOD_NOT_ALLOWED = ("METHOD_NOT_ALLOWED", "HTTP method is not allowed")
    CONFLICT = ("CONFLICT", "Request conflicts with the current state")
    RATE_LIMITED = ("RATE_LIMITED", "Too many requests")
    SERVICE_UNAVAILABLE = ("SERVICE_UNAVAILABLE", "Service is temporarily unavailable")
    INTERNAL_SERVER_ERROR = ("INTERNAL_SERVER_ERROR", "An unexpected server error occurred")
    HTTP_ERROR = ("HTTP_ERROR", "HTTP request failed")


class AuthErrorCode(ErrorCode):
    AUTHENTICATION_REQUIRED = ("AUTHENTICATION_REQUIRED", "Authentication is required")
    INVALID_CREDENTIALS = ("INVALID_CREDENTIALS", "Credentials are invalid")
    INVALID_REFRESH_TOKEN = ("INVALID_REFRESH_TOKEN", "Refresh token is invalid")


class UserErrorCode(ErrorCode):
    EMAIL_ALREADY_REGISTERED = ("EMAIL_ALREADY_REGISTERED", "Email is already registered")


class CharacterErrorCode(ErrorCode):
    CHARACTER_ALREADY_EXISTS = ("CHARACTER_ALREADY_EXISTS", "Character already exists")
    CHARACTER_NOT_FOUND = ("CHARACTER_NOT_FOUND", "Character was not found")


class SessionErrorCode(ErrorCode):
    ACTIVE_SESSION_EXISTS = ("ACTIVE_SESSION_EXISTS", "An active session already exists")
    NO_ACTIVE_SESSION = ("NO_ACTIVE_SESSION", "No active session was found")
    SESSION_NOT_FOUND = ("SESSION_NOT_FOUND", "Session was not found")
    SESSION_NOT_ACTIVE = ("SESSION_NOT_ACTIVE", "Session is not active")
    SESSION_END_BEFORE_START = (
        "SESSION_END_BEFORE_START",
        "Session end time is before its start time",
    )
    SESSION_END_TOO_FAR_FUTURE = (
        "SESSION_END_TOO_FAR_FUTURE",
        "Session end time is too far in the future",
    )


class AnalysisErrorCode(ErrorCode):
    ANALYSIS_NOT_RETRYABLE = ("ANALYSIS_NOT_RETRYABLE", "Session analysis cannot be retried")
    ANALYSIS_QUEUE_UNAVAILABLE = (
        "ANALYSIS_QUEUE_UNAVAILABLE",
        "Session analysis could not be queued",
    )
    ANALYSIS_FAILED = ("ANALYSIS_FAILED", "Session analysis failed")
    AI_CONFIGURATION_ERROR = ("AI_CONFIGURATION_ERROR", "AI provider is not configured")
    AI_PROVIDER_UNAVAILABLE = ("AI_PROVIDER_UNAVAILABLE", "AI provider is unavailable")


class EventErrorCode(ErrorCode):
    EVENT_BATCH_SENT_AT_TOO_FAR_FUTURE = (
        "EVENT_BATCH_SENT_AT_TOO_FAR_FUTURE",
        "Event batch timestamp is too far in the future",
    )
    EVENT_BATCH_SESSION_MISMATCH = (
        "EVENT_BATCH_SESSION_MISMATCH",
        "Event batch session does not match the requested session",
    )
    EVENT_AFTER_BATCH_SENT_AT = (
        "EVENT_AFTER_BATCH_SENT_AT",
        "Event occurred after the batch timestamp",
    )
    EVENT_BEFORE_SESSION_START = (
        "EVENT_BEFORE_SESSION_START",
        "Event occurred before the session started",
    )
    EVENT_SESSION_MISMATCH = (
        "EVENT_SESSION_MISMATCH",
        "Event belongs to a different session",
    )
    EVENT_USER_MISMATCH = (
        "EVENT_USER_MISMATCH",
        "Event belongs to a different user",
    )


type ApiErrorCode = (
    CommonErrorCode
    | AuthErrorCode
    | UserErrorCode
    | CharacterErrorCode
    | SessionErrorCode
    | AnalysisErrorCode
    | EventErrorCode
)


class ErrorPayload(BaseModel):
    code: ApiErrorCode
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorPayload


class ApiError(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: ApiErrorCode,
        *,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.code = code
        self.details = details or {}
        super().__init__(status_code=status_code, detail=code.value, headers=headers)


def _response(
    status_code: int,
    code: ApiErrorCode,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ErrorPayload(code=code, message=code.message, details=details or {})
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


def _generic_http_code(status_code: int) -> ApiErrorCode:
    codes: dict[int, ApiErrorCode] = {
        400: CommonErrorCode.BAD_REQUEST,
        401: AuthErrorCode.AUTHENTICATION_REQUIRED,
        403: CommonErrorCode.FORBIDDEN,
        404: CommonErrorCode.RESOURCE_NOT_FOUND,
        405: CommonErrorCode.METHOD_NOT_ALLOWED,
        409: CommonErrorCode.CONFLICT,
        422: CommonErrorCode.VALIDATION_ERROR,
        429: CommonErrorCode.RATE_LIMITED,
        503: CommonErrorCode.SERVICE_UNAVAILABLE,
    }
    return codes.get(status_code, CommonErrorCode.HTTP_ERROR)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        response = _response(exc.status_code, exc.code, exc.details)
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        issues = [
            {
                "field": ".".join(str(part) for part in error["loc"] if part != "body"),
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _response(422, CommonErrorCode.VALIDATION_ERROR, {"issues": issues})

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _response(exc.status_code, _generic_http_code(exc.status_code))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error", extra={"path": request.url.path}, exc_info=exc)
        return _response(500, CommonErrorCode.INTERNAL_SERVER_ERROR)
