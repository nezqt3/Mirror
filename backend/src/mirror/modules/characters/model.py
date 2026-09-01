from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mirror.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from mirror.modules.users.model import User


class Character(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "characters"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    name: Mapped[str] = mapped_column(String(80))
    avatar_key: Mapped[str | None] = mapped_column(String(512))
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    focus: Mapped[int] = mapped_column(Integer, default=1)
    stamina: Mapped[int] = mapped_column(Integer, default=1)
    execution: Mapped[int] = mapped_column(Integer, default=1)
    discipline: Mapped[int] = mapped_column(Integer, default=1)
    adaptability: Mapped[int] = mapped_column(Integer, default=1)
    energy: Mapped[int] = mapped_column(Integer, default=100)

    user: Mapped[User] = relationship(back_populates="character")
