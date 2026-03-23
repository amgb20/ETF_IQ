"""Unit tests for app.auth.audit — structured security audit logger.

Coverage target: 100% (security-critical module).
"""

from __future__ import annotations

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.auth.audit import AuthEvent, _FAILURE_EVENTS, _persist, log_auth_event


# ---------------------------------------------------------------------------
# log_auth_event — log level routing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success_logs_at_info(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(
            AuthEvent.LOGIN_SUCCESS,
            email="u@example.com",
            user_id="uid-1",
        )
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records, "Expected a log record from security.audit"
    assert records[0].levelno == logging.INFO


@pytest.mark.asyncio
async def test_login_failure_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_FAILURE, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_otp_rate_limited_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.OTP_RATE_LIMITED, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_account_disabled_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.ACCOUNT_DISABLED, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_start_rate_limited_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.START_RATE_LIMITED, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_invalid_algorithm_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.INVALID_ALGORITHM, detail="alg=none")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_token_revoked_logs_at_warning(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.TOKEN_REVOKED, user_id="uid-99")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_logout_logs_at_info(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGOUT, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.INFO


@pytest.mark.asyncio
async def test_token_refresh_logs_at_info(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.TOKEN_REFRESH, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    assert records[0].levelno == logging.INFO


# ---------------------------------------------------------------------------
# log_auth_event — JSON payload structure
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_log_output_is_valid_json(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(
            AuthEvent.LOGIN_SUCCESS,
            email="test@example.com",
            user_id="uid-abc",
            ip="1.2.3.4",
            detail="OTP verified",
        )
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert isinstance(parsed, dict)


@pytest.mark.asyncio
async def test_log_json_contains_event_field(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, email="u@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert parsed["event"] == "LOGIN_SUCCESS"


@pytest.mark.asyncio
async def test_log_json_contains_email_field(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, email="precise@example.com")
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert parsed["email"] == "precise@example.com"


@pytest.mark.asyncio
async def test_log_json_contains_user_id(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, user_id="uid-xyz")
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert parsed["user_id"] == "uid-xyz"


@pytest.mark.asyncio
async def test_log_json_contains_ip(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, ip="192.168.0.1")
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert parsed["ip"] == "192.168.0.1"


@pytest.mark.asyncio
async def test_log_json_contains_ts_field(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS)
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert "ts" in parsed
    # ts must be a non-empty ISO 8601 string
    assert len(parsed["ts"]) > 10


@pytest.mark.asyncio
async def test_log_json_contains_detail_field(caplog):
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_FAILURE, detail="bad OTP")
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    assert parsed["detail"] == "bad OTP"


@pytest.mark.asyncio
async def test_log_json_none_fields_present(caplog):
    """Fields not passed must be present with value None (not omitted)."""
    with caplog.at_level(logging.DEBUG, logger="security.audit"):
        await log_auth_event(AuthEvent.LOGIN_SUCCESS)
    records = [r for r in caplog.records if r.name == "security.audit"]
    parsed = json.loads(records[0].message)
    for field in ("email", "user_id", "ip", "detail"):
        assert field in parsed


# ---------------------------------------------------------------------------
# _persist — DB persistence behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persist_skipped_when_persist_audit_log_false(monkeypatch):
    """_persist must return immediately when PERSIST_AUDIT_LOG=False."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "false")
    config_module.get_settings.cache_clear()

    db = AsyncMock()
    record = {
        "event": "LOGIN_SUCCESS",
        "email": "u@example.com",
        "user_id": "uid",
        "ip": None,
        "detail": None,
    }

    await _persist(record, db)

    db.execute.assert_not_called()
    db.commit.assert_not_called()

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "false")
    config_module.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_persist_calls_db_execute_when_enabled(monkeypatch):
    """_persist must INSERT when PERSIST_AUDIT_LOG=True."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "true")
    config_module.get_settings.cache_clear()

    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    record = {
        "event": "LOGIN_SUCCESS",
        "email": "u@example.com",
        "user_id": "uid",
        "ip": "1.2.3.4",
        "detail": None,
    }

    await _persist(record, db)

    db.execute.assert_called_once()
    db.commit.assert_called_once()

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "false")
    config_module.get_settings.cache_clear()


@pytest.mark.asyncio
async def test_persist_never_raises_on_db_error(monkeypatch, caplog):
    """_persist must swallow DB exceptions and log a WARNING."""
    from app import config as config_module

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "true")
    config_module.get_settings.cache_clear()

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=Exception("DB connection lost"))

    record = {
        "event": "LOGOUT",
        "email": "u@example.com",
        "user_id": "uid",
        "ip": None,
        "detail": None,
    }

    with caplog.at_level(logging.WARNING, logger="security.audit"):
        # Must not raise
        await _persist(record, db)

    assert any("persist" in r.message.lower() for r in caplog.records)

    config_module.get_settings.cache_clear()
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "false")
    config_module.get_settings.cache_clear()


# ---------------------------------------------------------------------------
# log_auth_event — with db — calls _persist
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_log_auth_event_calls_persist_when_db_provided():
    db = AsyncMock()
    with patch("app.auth.audit._persist", new_callable=AsyncMock) as mock_persist:
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, email="u@example.com", db=db)
    mock_persist.assert_called_once()


@pytest.mark.asyncio
async def test_log_auth_event_does_not_call_persist_when_db_none():
    with patch("app.auth.audit._persist", new_callable=AsyncMock) as mock_persist:
        await log_auth_event(AuthEvent.LOGIN_SUCCESS, email="u@example.com", db=None)
    mock_persist.assert_not_called()


# ---------------------------------------------------------------------------
# AuthEvent enum completeness
# ---------------------------------------------------------------------------


def test_auth_event_enum_has_all_expected_values():
    expected = {
        "LOGIN_SUCCESS",
        "LOGIN_FAILURE",
        "ACCOUNT_DISABLED",
        "LOGOUT",
        "TOKEN_REFRESH",
        "OTP_RATE_LIMITED",
        "START_RATE_LIMITED",
        "INVALID_ALGORITHM",
        "TOKEN_REVOKED",
    }
    actual = {e.value for e in AuthEvent}
    assert expected == actual


def test_failure_events_set():
    """The failure events set must contain the right members."""
    expected_failures = {
        AuthEvent.LOGIN_FAILURE,
        AuthEvent.ACCOUNT_DISABLED,
        AuthEvent.OTP_RATE_LIMITED,
        AuthEvent.START_RATE_LIMITED,
        AuthEvent.INVALID_ALGORITHM,
        AuthEvent.TOKEN_REVOKED,
    }
    assert _FAILURE_EVENTS == expected_failures
