from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CanvasAI"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Supabase
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_anon_key: str | None = None
    supabase_jwt_secret: str | None = None  # <-- Added for JWT verification

    # LLM provider injection
    llm_provider: str = "openai"
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "OPEN_AI_API"),
    )
    openai_model: str = "gpt-4o-mini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # Inngest
    inngest_app_id: str = "canvasai"
    inngest_event_key: str | None = None
    inngest_signing_key: str | None = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()