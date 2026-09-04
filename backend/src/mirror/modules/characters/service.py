from datetime import date

from mirror.modules.characters.model import Character


def apply_daily_discipline(character: Character, activity_date: date) -> int:
    """Apply at most one discipline change per local calendar day."""
    previous_score = character.discipline
    previous_date = character.last_session_date

    if previous_date is None:
        character.current_streak = 1
        character.longest_streak = max(character.longest_streak, 1)
        character.discipline = min(100, character.discipline + 1)
        character.last_session_date = activity_date
        return character.discipline - previous_score

    if activity_date <= previous_date:
        return 0

    days_since_activity = (activity_date - previous_date).days
    if days_since_activity == 1:
        character.current_streak += 1
        character.discipline = min(100, character.discipline + 1)
    else:
        missed_days = days_since_activity - 1
        character.current_streak = 1
        character.discipline = max(1, character.discipline - min(missed_days, 5))

    character.longest_streak = max(character.longest_streak, character.current_streak)
    character.last_session_date = activity_date
    return character.discipline - previous_score
