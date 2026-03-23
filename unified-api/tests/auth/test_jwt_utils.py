"""Unit tests for app.auth.jwt_utils — internal service-to-service tokens."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt as jose_jwt

from app.auth.jwt_utils import ALGORITHM, create_internal_token, verify_internal_token
from app.config import get_settings


# ---------------------------------------------------------------------------
# create_internal_token
# ---------------------------------------------------------------------------


def test_create_internal_token_returns_string():
    token = create_internal_token({"service": "scheduler"})
    assert isinstance(token, str)
    assert len(token) > 0


def test_create_internal_token_issuer():
    token = create_internal_token({"service": "scheduler"})
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["iss"] == "portfolioiq-internal"


def test_create_internal_token_custom_payload_preserved():
    token = create_internal_token({"service": "data-ingest", "action": "refresh"})
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["service"] == "data-ingest"
    assert claims["action"] == "refresh"


def test_create_internal_token_custom_expiry():
    token = create_internal_token({"x": "y"}, expires_minutes=5)
    claims = jose_jwt.get_unverified_claims(token)
    now = datetime.now(timezone.utc).timestamp()
    # exp should be ~5 min from now (allow 5s drift)
    assert abs(claims["exp"] - (now + 300)) < 5


def test_create_internal_token_default_expiry_uses_settings():
    settings = get_settings()
    token = create_internal_token({"x": "y"})
    claims = jose_jwt.get_unverified_claims(token)
    now = datetime.now(timezone.utc).timestamp()
    expected = now + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert abs(claims["exp"] - expected) < 5


def test_create_internal_token_algorithm_is_hs256():
    token = create_internal_token({"x": "y"})
    header = jose_jwt.get_unverified_header(token)
    assert header["alg"] == ALGORITHM


# ---------------------------------------------------------------------------
# verify_internal_token — happy path
# ---------------------------------------------------------------------------


def test_verify_internal_token_returns_dict():
    token = create_internal_token({"svc": "test"})
    result = verify_internal_token(token)
    assert isinstance(result, dict)


def test_verify_internal_token_correct_claims():
    token = create_internal_token({"svc": "test", "sub": "worker"})
    result = verify_internal_token(token)
    assert result["svc"] == "test"
    assert result["sub"] == "worker"
    assert result["iss"] == "portfolioiq-internal"


# ---------------------------------------------------------------------------
# verify_internal_token — error paths
# ---------------------------------------------------------------------------


def test_verify_internal_token_raises_on_wrong_issuer():
    """User token (iss='portfolioiq-user') must be rejected — cross-token attack."""
    from app.auth.jwt import create_access_token

    user_token = create_access_token("uid", "u@example.com", "user")
    with pytest.raises(ValueError, match="Invalid internal token issuer"):
        verify_internal_token(user_token)


def test_verify_internal_token_raises_on_expired_token():
    settings = get_settings()
    payload = {
        "service": "test",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        "iss": "portfolioiq-internal",
    }
    expired = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(ValueError, match="Invalid internal token"):
        verify_internal_token(expired)


def test_verify_internal_token_raises_on_tampered_signature():
    token = create_internal_token({"x": "y"})
    import base64
    header, payload, _ = token.split(".")
    bad_sig = base64.urlsafe_b64encode(b"X" * 32).rstrip(b"=").decode()
    tampered = f"{header}.{payload}.{bad_sig}"
    with pytest.raises(ValueError, match="Invalid internal token"):
        verify_internal_token(tampered)


def test_verify_internal_token_raises_on_wrong_secret():
    payload = {
        "service": "x",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": "portfolioiq-internal",
    }
    evil = jose_jwt.encode(payload, "wrong-secret", algorithm=ALGORITHM)
    with pytest.raises(ValueError, match="Invalid internal token"):
        verify_internal_token(evil)


def test_verify_internal_token_raises_on_garbage_input():
    with pytest.raises(ValueError):
        verify_internal_token("garbage.token.value")


def test_verify_internal_token_raises_on_empty_token():
    with pytest.raises(ValueError):
        verify_internal_token("")


def test_verify_internal_token_raises_without_exp():
    """Tokens without an exp claim must be rejected (require_exp=True)."""
    settings = get_settings()
    payload = {"service": "test", "iss": "portfolioiq-internal"}
    no_exp = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(ValueError, match="Invalid internal token"):
        verify_internal_token(no_exp)
