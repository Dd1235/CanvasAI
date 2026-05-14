import os
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
    supabase_jwt_secret: str | None = None

    # LLM provider injection
    llm_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash-lite"
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "OPEN_AI_API"),
    )
    openai_model: str = "gpt-4o-mini"

    # LangSmith Tracing
    langchain_tracing_v2: str | None = Field(default=None, alias="LANGCHAIN_TRACING_V2")
    langchain_api_key: str | None = Field(default=None, alias="LANGCHAIN_API_KEY")
    langchain_project: str | None = Field(default=None, alias="LANGCHAIN_PROJECT")

    # Inngest
    inngest_app_id: str = "canvasai"
    inngest_event_key: str | None = None
    inngest_signing_key: str | None = None

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    
    # EXPLICITLY INJECT LANGSMITH INTO THE SYSTEM ENVIRONMENT
    if settings.langchain_tracing_v2 == "true" and settings.langchain_api_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
        os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"
        if settings.langchain_project:
            os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project
            
    return settings