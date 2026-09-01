from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    avatar_key: str | None = Field(default=None, max_length=512)


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    avatar_key: str | None
    level: int
    xp: int
    focus: int
    stamina: int
    execution: int
    discipline: int
    adaptability: int
    energy: int
