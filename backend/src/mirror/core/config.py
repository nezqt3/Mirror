from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Mirror API"
    environment: str = "local"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    secret_key: SecretStr = SecretStr("local-development-key-change-me-123")
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 30

    database_url: str = "postgresql+asyncpg://mirror:mirror@localhost:5432/mirror"
    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint_url: str | None = "http://localhost:9000"
    s3_access_key: SecretStr = SecretStr("mirror")
    s3_secret_key: SecretStr = SecretStr("mirror-secret")
    s3_bucket: str = "mirror-private"
    s3_region: str = "us-east-1"

    ai_enabled: bool = False
    ai_provider_url: str = "https://api.groq.com/openai/v1"
    ai_api_key: SecretStr | None = None
    ai_model: str = "openai/gpt-oss-120b"
    ai_reasoning_effort: Literal["low", "medium", "high"] = "medium"
    ai_timeout_seconds: int = Field(default=60, ge=5, le=240)
    ai_max_completion_tokens: int = Field(default=1600, ge=256, le=8192)
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:1420"])

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("SECRET_KEY must contain at least 32 characters")
        return value

    @field_validator("ai_api_key")
    @classmethod
    def normalize_ai_api_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None or not value.get_secret_value().strip():
            return None
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
