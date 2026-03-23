"""Redis-backed token blocklist for JWT revocation.

When a user logs out (or a token is refreshed), its ``jti`` claim is written
to Redis with a TTL equal to the token's remaining lifetime.  Every protected
request checks this store before granting access.

If Redis is unavailable the check fails open (returns ``False``) so that a
Redis outage doesn't lock all users out of the application.  A WARNING is
logged so the condition is visible in monitoring.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_BLOCKED_KEY_PREFIX = "token:blocked:"

# Module-level Redis client (connection pool).  Created lazily on first use
# and reused for the lifetime of the process — never closed mid-operation.
_redis_client: Optional[object] = None


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
        logger.warning("Token blocklist: could not create Redis pool: %s", exc)
        return None


async def block_token(jti: str, ttl_seconds: int) -> None:
    """Add ``jti`` to the blocklist with a TTL matching token expiry.

    After ``ttl_seconds`` the key auto-expires from Redis — no background
    cleanup job is needed.
    """
    if ttl_seconds <= 0:
        return  # Already expired — nothing to block.

    redis = await _get_redis()
    if redis is None:
        logger.warning("Token blocklist: Redis unavailable — cannot revoke jti=%s", jti)
        return

    try:
        key = f"{_BLOCKED_KEY_PREFIX}{jti}"
        await redis.setex(key, ttl_seconds, "1")
        logger.info("Token blocklist: revoked jti=%s (ttl=%ds)", jti, ttl_seconds)
    except Exception as exc:
        logger.warning("Token blocklist: failed to block jti=%s: %s", jti, exc)


async def is_token_blocked(jti: str) -> bool:
    """Return ``True`` if the token has been revoked, ``False`` otherwise.

    Fails open on Redis errors — a Redis outage will not lock users out.
    """
    redis = await _get_redis()
    if redis is None:
        return False

    try:
        key = f"{_BLOCKED_KEY_PREFIX}{jti}"
        result = await redis.exists(key)
        return bool(result)
    except Exception as exc:
        logger.warning("Token blocklist: Redis error on exists check — failing open: %s", exc)
        return False
