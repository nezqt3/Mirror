from datetime import timedelta

import jwt
import pytest

from mirror.core.security import create_token, decode_token, hash_password, verify_password


def test_password_round_trip() -> None:
    digest = hash_password("a-strong-test-password")
    assert verify_password("a-strong-test-password", digest)
    assert not verify_password("wrong-password", digest)


def test_token_round_trip_and_type_check() -> None:
    token = create_token("user-id", "access", timedelta(minutes=1))
    assert decode_token(token) == "user-id"
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token, expected_type="refresh")
