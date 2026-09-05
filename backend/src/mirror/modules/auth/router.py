from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from mirror.api.dependencies import DbSession
from mirror.core.security import decode_token_payload
from mirror.modules.auth.model import RefreshSession
from mirror.modules.auth.schema import LoginRequest, RefreshRequest, TokenPair
from mirror.modules.auth.service import authenticate, hash_token, issue_tokens
from mirror.modules.users.model import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    user = await authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    tokens = issue_tokens(db, user.id)
    await db.commit()
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    try:
        claims = decode_token_payload(payload.refresh_token, expected_type="refresh")
        user_id = UUID(str(claims["sub"]))
        refresh_id = UUID(str(claims["jti"]))
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    refresh_session = await db.scalar(
        select(RefreshSession).where(RefreshSession.id == refresh_id).with_for_update()
    )
    now = datetime.now(UTC)
    if (
        refresh_session is None
        or refresh_session.user_id != user_id
        or refresh_session.revoked_at is not None
        or refresh_session.expires_at <= now
        or refresh_session.token_hash != hash_token(payload.refresh_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    refresh_session.revoked_at = now
    tokens = issue_tokens(db, user_id)
    await db.commit()
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: DbSession) -> Response:
    try:
        claims = decode_token_payload(payload.refresh_token, expected_type="refresh")
        refresh_id = UUID(str(claims["jti"]))
    except (jwt.InvalidTokenError, ValueError):
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    refresh_session = await db.get(RefreshSession, refresh_id)
    if refresh_session is not None and refresh_session.revoked_at is None:
        refresh_session.revoked_at = datetime.now(UTC)
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
