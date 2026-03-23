"""Shared Redis connection pool for the auth module.

A single lazily-created connection pool is shared by token_blocklist and
otp_limiter, avoiding duplicate pools.  If Redis is not configured or the
pool cannot be created, ``get_redis()`` returns ``None`` and callers fail open.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_redis_client: Optional[object] = None


async def get_redis():
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
        logger.warning("Auth Redis: could not create Redis pool: %s", exc)
        return None
