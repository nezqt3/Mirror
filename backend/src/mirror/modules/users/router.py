from fastapi import APIRouter, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.core.errors import ApiError, UserErrorCode
from mirror.core.security import hash_password
from mirror.modules.users.model import User
from mirror.modules.users.schema import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: DbSession) -> User:
    email = payload.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise ApiError(status.HTTP_409_CONFLICT, UserErrorCode.EMAIL_ALREADY_REGISTERED)
    user = User(
        email=email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me", response_model=UserRead)
async def read_me(current_user: CurrentUser) -> User:
    return current_user
