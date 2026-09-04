from datetime import date
from uuid import uuid4

from mirror.modules.characters.model import Character
from mirror.modules.characters.service import apply_daily_discipline


def test_discipline_rewards_consecutive_days_once() -> None:
    character = _character()

    assert apply_daily_discipline(character, date(2026, 9, 1)) == 1
    assert apply_daily_discipline(character, date(2026, 9, 1)) == 0
    assert apply_daily_discipline(character, date(2026, 9, 2)) == 1
    assert character.current_streak == 2
    assert character.longest_streak == 2
    assert character.discipline == 3


def test_discipline_penalizes_missed_days_with_a_cap() -> None:
    character = _character()
    character.discipline = 10
    character.last_session_date = date(2026, 8, 20)
    character.current_streak = 8
    character.longest_streak = 8

    assert apply_daily_discipline(character, date(2026, 9, 1)) == -5
    assert character.current_streak == 1
    assert character.longest_streak == 8
    assert character.discipline == 5


def _character() -> Character:
    return Character(
        user_id=uuid4(),
        name="Test Character",
        discipline=1,
        current_streak=0,
        longest_streak=0,
    )
