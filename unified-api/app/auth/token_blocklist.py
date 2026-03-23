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

from app.auth.redis import get_redis as _get_redis

logger = logging.getLogger(__name__)

_BLOCKED_KEY_PREFIX = "token:blocked:"


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
