"""Per-email OTP sliding-window rate limiter backed by Redis.

Two independent limits are enforced:
  - /start  : max 3 requests per email per hour   (prevents inbox spam)
  - /verify : max 5 attempts per email per 10 min (prevents OTP brute-force)

Redis sorted sets are used (ZADD / ZREMRANGEBYSCORE / ZCARD) so the window
slides correctly and TTLs are managed server-side.

If Redis is unavailable the limiter logs a warning and fails open — the
request is allowed through.  This is deliberate: Auth0 enforces its own
server-side OTP rate limits as a last line of defence.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import HTTPException, status

from app.auth.audit import AuthEvent

logger = logging.getLogger(__name__)

# /verify limits
OTP_WINDOW_SECONDS: int = 600   # 10-minute sliding window
OTP_MAX_ATTEMPTS: int = 5

# /start limits
START_WINDOW_SECONDS: int = 3600  # 1-hour sliding window
START_MAX_ATTEMPTS: int = 3

# Module-level Redis client (connection pool).  Created lazily on first use
# and reused for the lifetime of the process — never closed mid-operation.
_redis_client: Optional[object] = None


def _redis_key(prefix: str, email: str) -> str:
    return f"otp:{prefix}:{email.lower().strip()}"


async def _get_redis():
    """Return the shared Redis pool, creating it on first call.

    Returns None when Redis is not configured or the pool cannot be created.
    The pool is shared across all calls — callers must NOT call aclose().
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from app.config import get_settings
        settings = get_settings()
        if not settings.USE_REDIS or not settings.REDIS_URL:
            return None
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception as exc:
        logger.warning("OTP limiter: could not create Redis pool: %s", exc)
        return None


async def _sliding_window_check(
    key: str,
    window_seconds: int,
    max_attempts: int,
    email: str,
    event: AuthEvent,
) -> None:
    """Increment the sliding window counter and raise 429 if over limit."""
    redis = await _get_redis()
    if redis is None:
        logger.warning("OTP limiter: Redis unavailable — skipping rate limit for %s", email)
        return

    try:
        now = time.time()
        window_start = now - window_seconds

        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, "-inf", window_start)  # Evict expired entries.
        pipe.zadd(key, {str(now): now})                   # Record this attempt.
        pipe.zcard(key)                                    # Count remaining.
        pipe.expire(key, window_seconds)                   # Auto-clean the key.
        results = await pipe.execute()
        count = results[2]  # ZCARD result

        if count > max_attempts:
            logger.warning(
                "OTP limiter: %s rate limit exceeded for %s (%d attempts in %ds window)",
                event.value, email, count, window_seconds,
            )
            from app.auth.audit import log_auth_event
            await log_auth_event(
                event,
                email=email,
                detail=f"{count} attempts in {window_seconds}s window",
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait before trying again.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("OTP limiter: Redis error — failing open: %s", exc)


async def check_otp_rate_limit(email: str) -> None:
    """Check the /verify sliding-window limit for this email."""
    await _sliding_window_check(
        key=_redis_key("verify", email),
        window_seconds=OTP_WINDOW_SECONDS,
        max_attempts=OTP_MAX_ATTEMPTS,
        email=email,
        event=AuthEvent.OTP_RATE_LIMITED,
    )


async def reset_otp_rate_limit(email: str) -> None:
    """Delete the verify counter after a successful login."""
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.delete(_redis_key("verify", email.lower().strip()))
    except Exception as exc:
        logger.warning("OTP limiter: could not reset verify key for %s: %s", email, exc)


async def check_start_rate_limit(email: str) -> None:
    """Check the /start sliding-window limit for this email."""
    await _sliding_window_check(
        key=_redis_key("start", email),
        window_seconds=START_WINDOW_SECONDS,
        max_attempts=START_MAX_ATTEMPTS,
        email=email,
        event=AuthEvent.START_RATE_LIMITED,
    )
