from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from mirror.core.config import get_settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, password_digest: str) -> bool:
    return password_hash.verify(password, password_digest)


def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    settings = get_settings()
    return jwt.encode(payload, settings.secret_key.get_secret_value(), algorithm="HS256")


def decode_token(token: str, expected_type: str = "access") -> str:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key.get_secret_value(), algorithms=["HS256"])
    if payload.get("type") != expected_type or not payload.get("sub"):
        raise jwt.InvalidTokenError("Invalid token type or subject")
    return str(payload["sub"])
