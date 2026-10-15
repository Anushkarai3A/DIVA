"""Application configuration loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "DIVA Deviation API"
    DATABASE_URL: str = "postgresql://diva:diva@localhost:5432/diva"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    FRONTEND_URL: str = "http://localhost:5173"
    DEMO_MODE: bool = True

    MAX_UPLOAD_MB: int = 5
    AI_TIMEOUT_S: int = 45
    MAX_INPUT_CHARS: int = 50000
    ALLOWED_EXTENSIONS: set[str] = {"pdf", "docx", "txt", "eml"}

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def active_provider(self) -> str:
        if self.DEMO_MODE:
            return "demo"
        return "groq" if self.GROQ_API_KEY else "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
