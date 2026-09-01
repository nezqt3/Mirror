from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mirror.core.config import get_settings
from mirror.core.security import create_token, verify_password
from mirror.modules.auth.schema import TokenPair
from mirror.modules.users.model import User


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(user_id: str) -> TokenPair:
    settings = get_settings()
    return TokenPair(
        access_token=create_token(
            user_id, "access", timedelta(minutes=settings.access_token_ttl_minutes)
        ),
        refresh_token=create_token(
            user_id, "refresh", timedelta(days=settings.refresh_token_ttl_days)
        ),
    )
