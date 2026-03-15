from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://portfolioiq:portfolioiq@localhost:5432/portfolioiq"

    # Auth0
    AUTH0_DOMAIN: str = ""
    AUTH0_CLIENT_ID: str = ""
    AUTH0_CLIENT_SECRET: str = ""
    AUTH0_AUDIENCE: str = ""

    # Internal JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600

    # Gemini
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "models/gemini-3.1-pro-preview"
    GEMINI_FLASH_MODEL: str = "models/gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-2-preview"

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "PortfolioIQ <noreply@portfolioiq.app>"

    # Prompt versioning
    PROMPT_VERSION: str = "v1"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
