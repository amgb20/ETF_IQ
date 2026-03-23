"""Unit tests for app.auth.otp_limiter — per-email sliding-window rate limiter."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.auth.otp_limiter import (
    OTP_MAX_ATTEMPTS,
    START_MAX_ATTEMPTS,
    _redis_key,
    check_otp_rate_limit,
    check_start_rate_limit,
    reset_otp_rate_limit,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_pipeline_mock(zcard_result: int) -> AsyncMock:
    """Return a mock Redis pipeline whose ZCARD result is zcard_result."""
    pipe = AsyncMock()
    pipe.zremrangebyscore = MagicMock()
    pipe.zadd = MagicMock()
    pipe.zcard = MagicMock()
    pipe.expire = MagicMock()
    # pipeline.execute() returns [zremrangebyscore_result, zadd_result, zcard_result, expire_result]
    pipe.execute = AsyncMock(return_value=[0, 1, zcard_result, True])
    return pipe


def _make_redis_mock(zcard_result: int = 1) -> AsyncMock:
    redis = AsyncMock()
    redis.pipeline = MagicMock(return_value=_make_pipeline_mock(zcard_result))
    redis.delete = AsyncMock(return_value=1)
    return redis


# ---------------------------------------------------------------------------
# _redis_key helper
# ---------------------------------------------------------------------------


def test_redis_key_normalises_email_to_lowercase():
    key = _redis_key("verify", "USER@EXAMPLE.COM")
    assert "user@example.com" in key


def test_redis_key_strips_whitespace():
    key = _redis_key("verify", "  user@example.com  ")
    assert "user@example.com" in key


def test_redis_key_includes_prefix():
    key = _redis_key("verify", "u@e.com")
    assert key.startswith("otp:verify:")

    key2 = _redis_key("start", "u@e.com")
    assert key2.startswith("otp:start:")


# ---------------------------------------------------------------------------
# check_otp_rate_limit — /verify
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_otp_rate_limit_allows_under_limit():
    """count <= OTP_MAX_ATTEMPTS must not raise."""
    redis_mock = _make_redis_mock(zcard_result=OTP_MAX_ATTEMPTS)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        # Must not raise
        await check_otp_rate_limit("user@example.com")


@pytest.mark.asyncio
async def test_check_otp_rate_limit_allows_exactly_at_limit():
    redis_mock = _make_redis_mock(zcard_result=OTP_MAX_ATTEMPTS)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await check_otp_rate_limit("user@example.com")


@pytest.mark.asyncio
async def test_check_otp_rate_limit_raises_429_over_limit():
    """count > OTP_MAX_ATTEMPTS must raise HTTP 429."""
    redis_mock = _make_redis_mock(zcard_result=OTP_MAX_ATTEMPTS + 1)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with patch("app.auth.audit.log_auth_event", new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc_info:
                await check_otp_rate_limit("user@example.com")

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_check_otp_rate_limit_429_detail_message():
    redis_mock = _make_redis_mock(zcard_result=OTP_MAX_ATTEMPTS + 5)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with patch("app.auth.audit.log_auth_event", new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc_info:
                await check_otp_rate_limit("user@example.com")

    assert "too many" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_check_otp_rate_limit_fails_open_when_redis_none():
    """No Redis → fail open (allow request through, no exception)."""
    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=None):
        # Must not raise
        await check_otp_rate_limit("user@example.com")


@pytest.mark.asyncio
async def test_check_otp_rate_limit_fails_open_on_pipeline_exception(caplog):
    """Pipeline exception → fail open, log WARNING."""
    redis_mock = _make_redis_mock()
    pipe = redis_mock.pipeline.return_value
    pipe.execute = AsyncMock(side_effect=Exception("Redis down"))

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with caplog.at_level(logging.WARNING, logger="app.auth.otp_limiter"):
            # Must not raise
            await check_otp_rate_limit("user@example.com")


# ---------------------------------------------------------------------------
# check_start_rate_limit — /start
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_start_rate_limit_allows_under_limit():
    redis_mock = _make_redis_mock(zcard_result=START_MAX_ATTEMPTS)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await check_start_rate_limit("user@example.com")


@pytest.mark.asyncio
async def test_check_start_rate_limit_raises_429_over_limit():
    redis_mock = _make_redis_mock(zcard_result=START_MAX_ATTEMPTS + 1)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with patch("app.auth.audit.log_auth_event", new_callable=AsyncMock):
            with pytest.raises(HTTPException) as exc_info:
                await check_start_rate_limit("user@example.com")

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_check_start_rate_limit_fails_open_when_redis_none():
    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=None):
        await check_start_rate_limit("user@example.com")


# ---------------------------------------------------------------------------
# reset_otp_rate_limit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reset_otp_rate_limit_deletes_correct_key():
    redis_mock = _make_redis_mock()

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        await reset_otp_rate_limit("USER@Example.com")

    # The key should be normalised to lowercase
    expected_key = _redis_key("verify", "USER@Example.com")
    redis_mock.delete.assert_called_once_with(expected_key)


@pytest.mark.asyncio
async def test_reset_otp_rate_limit_skips_when_redis_none():
    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=None):
        # Must not raise
        await reset_otp_rate_limit("user@example.com")


@pytest.mark.asyncio
async def test_reset_otp_rate_limit_fails_open_on_exception(caplog):
    redis_mock = _make_redis_mock()
    redis_mock.delete = AsyncMock(side_effect=Exception("Redis gone"))

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with caplog.at_level(logging.WARNING, logger="app.auth.otp_limiter"):
            # Must not raise
            await reset_otp_rate_limit("user@example.com")


# ---------------------------------------------------------------------------
# OTP rate limit audit event type
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_otp_rate_limit_emits_otp_rate_limited_event():
    """When /verify is exceeded, OTP_RATE_LIMITED event must be logged."""
    from app.auth.audit import AuthEvent

    redis_mock = _make_redis_mock(zcard_result=OTP_MAX_ATTEMPTS + 1)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with patch("app.auth.audit.log_auth_event", new_callable=AsyncMock) as mock_log:
            with pytest.raises(HTTPException):
                await check_otp_rate_limit("user@example.com")

    mock_log.assert_called_once()
    event_arg = mock_log.call_args.args[0]
    assert event_arg == AuthEvent.OTP_RATE_LIMITED


@pytest.mark.asyncio
async def test_check_start_rate_limit_emits_start_rate_limited_event():
    """When /start is exceeded, START_RATE_LIMITED event must be logged."""
    from app.auth.audit import AuthEvent

    redis_mock = _make_redis_mock(zcard_result=START_MAX_ATTEMPTS + 1)

    with patch("app.auth.otp_limiter._get_redis", new_callable=AsyncMock, return_value=redis_mock):
        with patch("app.auth.audit.log_auth_event", new_callable=AsyncMock) as mock_log:
            with pytest.raises(HTTPException):
                await check_start_rate_limit("user@example.com")

    mock_log.assert_called_once()
    event_arg = mock_log.call_args.args[0]
    assert event_arg == AuthEvent.START_RATE_LIMITED


# ---------------------------------------------------------------------------
# _get_redis internal — settings-driven behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_otp_get_redis_returns_none_when_use_redis_false(monkeypatch):
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "false")
    config_module.get_settings.cache_clear()

    from app.auth.redis import get_redis

    with patch("app.auth.redis._redis_client", None):
        result = await get_redis()
    assert result is None

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "true")
    config_module.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_otp_get_redis_returns_none_on_exception(monkeypatch, caplog):
    """If redis.asyncio.from_url raises, get_redis must return None and log WARNING."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("USE_REDIS", "true")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    config_module.get_settings.cache_clear()

    with patch("redis.asyncio.from_url", side_effect=Exception("otp redis error")):
        from app.auth.redis import get_redis

        with patch("app.auth.redis._redis_client", None):
            with caplog.at_level(logging.WARNING, logger="app.auth.redis"):
                result = await get_redis()

    assert result is None

    config_module.get_settings.cache_clear()
