from datetime import timedelta
from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, status

from mirror.api.dependencies import DbSession
from mirror.core.config import get_settings
from mirror.core.security import create_token, decode_token
from mirror.modules.auth.schema import LoginRequest, RefreshRequest, TokenPair
from mirror.modules.auth.service import authenticate, issue_tokens
from mirror.modules.users.model import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, db: DbSession) -> TokenPair:
    user = await authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return issue_tokens(str(user.id))


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    try:
        user_id = UUID(decode_token(payload.refresh_token, expected_type="refresh"))
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from None
    if await db.get(User, user_id) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    settings = get_settings()
    return TokenPair(
        access_token=create_token(
            str(user_id), "access", timedelta(minutes=settings.access_token_ttl_minutes)
        ),
        refresh_token=payload.refresh_token,
    )
