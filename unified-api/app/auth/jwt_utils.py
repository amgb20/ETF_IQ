"""Internal HS256 JWT helper for service-to-service calls."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from app.config import get_settings

ALGORITHM = "HS256"


def create_internal_token(payload: dict, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode = {**payload, "exp": expire, "iss": "portfolioiq-internal"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def verify_internal_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM], options={"require_exp": True})
    except JWTError as exc:
        raise ValueError(f"Invalid internal token: {exc}") from exc
