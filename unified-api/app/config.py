from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    DEBUG: bool = False

    # Auth0
    AUTH0_DOMAIN: str = ""
    AUTH0_CLIENT_ID: str = ""
    AUTH0_CLIENT_SECRET: str = ""
    AUTH0_AUDIENCE: str = ""

    # Auth0 Management API (separate M2M application in Auth0 dashboard)
    AUTH0_MGMT_CLIENT_ID: str = ""
    AUTH0_MGMT_CLIENT_SECRET: str = ""

    # Internal JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600

    # Redis (token blocklist, OTP rate limiting, distributed rate limiting)
    REDIS_URL: str = ""
    USE_REDIS: bool = False

    # Security audit log — set to true to persist events to auth_audit_log table
    PERSIST_AUDIT_LOG: bool = False

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

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def jwt_secret_must_not_be_default(cls, v: str) -> str:
        if v == "change-me-in-production":
            raise ValueError(
                "JWT_SECRET_KEY must be overridden before use. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
