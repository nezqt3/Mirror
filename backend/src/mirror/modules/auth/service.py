import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mirror.core.config import get_settings
from mirror.core.security import create_token, verify_password
from mirror.modules.auth.model import RefreshSession
from mirror.modules.auth.schema import TokenPair
from mirror.modules.users.model import User


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(db: AsyncSession, user_id: UUID) -> TokenPair:
    settings = get_settings()
    refresh_id = uuid4()
    refresh_token = create_token(
        str(user_id),
        "refresh",
        timedelta(days=settings.refresh_token_ttl_days),
        token_id=str(refresh_id),
    )
    db.add(
        RefreshSession(
            id=refresh_id,
            user_id=user_id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    return TokenPair(
        access_token=create_token(
            str(user_id), "access", timedelta(minutes=settings.access_token_ttl_minutes)
        ),
        refresh_token=refresh_token,
    )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
