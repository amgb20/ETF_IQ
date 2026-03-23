"""Unit tests for app.auth.token_blocklist — Redis-backed JWT revocation.

Coverage target: 100% (security-critical module).
All Redis I/O is mocked via unittest.mock.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest

from app.auth.token_blocklist import (
    _BLOCKED_KEY_PREFIX,
    block_token,
    is_token_blocked,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_redis_mock(exists_result: int = 0) -> AsyncMock:
    """Return an AsyncMock that quacks like redis.asyncio.Redis."""
    redis = AsyncMock()
    redis.setex = AsyncMock(return_value=True)
    redis.exists = AsyncMock(return_value=exists_result)
    return redis


# ---------------------------------------------------------------------------
# block_token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_block_token_calls_setex_with_correct_key():
    jti = "some-jti-value"
    redis_mock = _make_redis_mock()

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await block_token(jti, ttl_seconds=300)

    expected_key = f"{_BLOCKED_KEY_PREFIX}{jti}"
    redis_mock.setex.assert_called_once_with(expected_key, 300, "1")


@pytest.mark.asyncio
async def test_block_token_calls_setex_with_correct_ttl():
    redis_mock = _make_redis_mock()

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await block_token("jti-abc", ttl_seconds=3600)

    _, call_args, _ = redis_mock.setex.mock_calls[0]
    assert call_args[1] == 3600


@pytest.mark.asyncio
async def test_block_token_skips_when_ttl_zero():
    """ttl_seconds=0 means token already expired — nothing to block."""
    redis_mock = _make_redis_mock()

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock) as mock_get_redis:
        await block_token("jti-expired", ttl_seconds=0)
        mock_get_redis.assert_not_called()

    redis_mock.setex.assert_not_called()


@pytest.mark.asyncio
async def test_block_token_skips_when_ttl_negative():
    redis_mock = _make_redis_mock()

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock) as mock_get_redis:
        await block_token("jti-neg", ttl_seconds=-10)
        mock_get_redis.assert_not_called()


@pytest.mark.asyncio
async def test_block_token_skips_when_redis_unavailable():
    """No Redis → skip silently, no exception raised."""
    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=None):
        # Must not raise
        await block_token("jti-no-redis", ttl_seconds=60)


@pytest.mark.asyncio
async def test_block_token_fails_open_on_redis_exception(caplog):
    """If setex raises, block_token must log a WARNING and not re-raise."""
    redis_mock = _make_redis_mock()
    redis_mock.setex = AsyncMock(side_effect=Exception("Redis connection refused"))

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with caplog.at_level(logging.WARNING, logger="app.auth.token_blocklist"):
            # Must not raise
            await block_token("jti-fail", ttl_seconds=60)

    assert any("failed to block" in r.message.lower() for r in caplog.records)


# ---------------------------------------------------------------------------
# is_token_blocked
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_is_token_blocked_returns_true_for_blocked_jti():
    redis_mock = _make_redis_mock(exists_result=1)

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        result = await is_token_blocked("blocked-jti")

    assert result is True


@pytest.mark.asyncio
async def test_is_token_blocked_returns_false_for_unknown_jti():
    redis_mock = _make_redis_mock(exists_result=0)

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        result = await is_token_blocked("unknown-jti")

    assert result is False


@pytest.mark.asyncio
async def test_is_token_blocked_checks_correct_key():
    jti = "my-specific-jti"
    redis_mock = _make_redis_mock(exists_result=0)

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await is_token_blocked(jti)

    expected_key = f"{_BLOCKED_KEY_PREFIX}{jti}"
    redis_mock.exists.assert_called_once_with(expected_key)


@pytest.mark.asyncio
async def test_is_token_blocked_returns_false_when_redis_none():
    """No Redis → fail open (return False, no exception)."""
    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=None):
        result = await is_token_blocked("jti-no-redis")

    assert result is False


@pytest.mark.asyncio
async def test_is_token_blocked_fails_open_on_redis_exception(caplog):
    """Redis.exists() raises → return False and log WARNING."""
    redis_mock = _make_redis_mock()
    redis_mock.exists = AsyncMock(side_effect=Exception("connection lost"))

    with patch("app.auth.token_blocklist._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with caplog.at_level(logging.WARNING, logger="app.auth.token_blocklist"):
            result = await is_token_blocked("jti-err")

    assert result is False
    assert any("failing open" in r.message.lower() for r in caplog.records)


# ---------------------------------------------------------------------------
# _get_redis internal — settings-driven behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_redis_returns_none_when_use_redis_false(monkeypatch):
    """When USE_REDIS=false, _get_redis must return None."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "false")
    config_module.get_settings.cache_clear()

    from app.auth.token_blocklist import _get_redis

    # Patch the singleton to None so we exercise the creation path.
    with patch("app.auth.token_blocklist._redis_client", None):
        result = await _get_redis()
    assert result is None

    # Restore
    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "true")
    config_module.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_redis_returns_none_when_redis_url_empty(monkeypatch):
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "true")
    monkeypatch.setenv("REDIS_URL", "")
    config_module.get_settings.cache_clear()

    from app.auth.token_blocklist import _get_redis

    with patch("app.auth.token_blocklist._redis_client", None):
        result = await _get_redis()
    assert result is None

    # Restore
    config_module.get_settings.cache_clear()
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    config_module.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_get_redis_returns_none_on_import_exception(monkeypatch, caplog):
    """If the redis.asyncio import or from_url raises, _get_redis must return None."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "true")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    config_module.get_settings.cache_clear()

    with patch("redis.asyncio.from_url", side_effect=Exception("connection refused")):
        from app.auth.token_blocklist import _get_redis

        with patch("app.auth.token_blocklist._redis_client", None):
            with caplog.at_level(logging.WARNING, logger="app.auth.token_blocklist"):
                result = await _get_redis()

    assert result is None

    config_module.get_settings.cache_clear()
