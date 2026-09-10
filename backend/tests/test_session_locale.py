import pytest
from pydantic import ValidationError
from sqlalchemy import CheckConstraint

from mirror.modules.sessions.model import FocusSession
from mirror.modules.sessions.schema import SessionCreate


def test_session_locale_defaults_to_english() -> None:
    session = SessionCreate(goal="Finish presentation", planned_duration_minutes=60)

    assert session.analysis_locale == "en"


def test_session_locale_accepts_simplified_chinese() -> None:
    session = SessionCreate(
        goal="完成演示文稿",
        planned_duration_minutes=60,
        analysis_locale="zh-CN",
    )

    assert session.analysis_locale == "zh-CN"


def test_session_locale_accepts_russian_without_normalizing_it() -> None:
    session = SessionCreate(
        goal="Завершить презентацию",
        planned_duration_minutes=60,
        analysis_locale="ru",
    )

    assert session.analysis_locale == "ru"
    assert session.model_dump()["analysis_locale"] == "ru"


@pytest.mark.parametrize("locale", ["RU", "ru-RU", "zh", "de", "", None])
def test_session_locale_rejects_unsupported_or_noncanonical_values(locale: object) -> None:
    with pytest.raises(ValidationError):
        SessionCreate.model_validate(
            {
                "goal": "Finish presentation",
                "planned_duration_minutes": 60,
                "analysis_locale": locale,
            }
        )


def test_database_constraint_matches_api_locales() -> None:
    locale_constraints = [
        str(constraint.sqltext)
        for constraint in FocusSession.__table__.constraints
        if isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_focus_sessions_ck_focus_sessions_analysis_locale"
    ]

    assert locale_constraints == ["analysis_locale IN ('en', 'zh-CN', 'ru')"]
