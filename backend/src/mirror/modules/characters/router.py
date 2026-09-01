from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from mirror.api.dependencies import CurrentUser, DbSession
from mirror.modules.characters.model import Character
from mirror.modules.characters.schema import CharacterCreate, CharacterRead

router = APIRouter(prefix="/character", tags=["character"])


@router.post("", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
async def create_character(
    payload: CharacterCreate, db: DbSession, current_user: CurrentUser
) -> Character:
    if await db.scalar(select(Character.id).where(Character.user_id == current_user.id)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Character already exists")
    character = Character(user_id=current_user.id, **payload.model_dump())
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return character


@router.get("", response_model=CharacterRead)
async def read_character(db: DbSession, current_user: CurrentUser) -> Character:
    character = await db.scalar(select(Character).where(Character.user_id == current_user.id))
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character
