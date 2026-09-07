import pytest
from pydantic import ValidationError

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


def test_session_locale_rejects_unsupported_values() -> None:
    with pytest.raises(ValidationError):
        SessionCreate(
            goal="Finish presentation",
            planned_duration_minutes=60,
            analysis_locale="ru",
        )
