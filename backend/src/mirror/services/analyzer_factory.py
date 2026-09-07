from mirror.core.config import Settings
from mirror.services.analyzer import Analyzer, BaselineSessionAnalyzer
from mirror.services.groq_analyzer import GroqSessionAnalyzer, PermanentAnalyzerError


def create_analyzer(settings: Settings) -> Analyzer:
    if not settings.ai_enabled:
        return BaselineSessionAnalyzer()
    if settings.ai_api_key is None:
        raise PermanentAnalyzerError("AI_API_KEY must be set when AI_ENABLED=true")
    return GroqSessionAnalyzer(
        api_key=settings.ai_api_key.get_secret_value(),
        base_url=settings.ai_provider_url,
        model=settings.ai_model,
        reasoning_effort=settings.ai_reasoning_effort,
        timeout_seconds=settings.ai_timeout_seconds,
        max_completion_tokens=settings.ai_max_completion_tokens,
    )
