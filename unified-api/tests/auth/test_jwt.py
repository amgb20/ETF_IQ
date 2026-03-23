"""Unit tests for app.auth.jwt — internal HS256 user tokens.

Coverage targets: 100% lines, branches, functions.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt as jose_jwt

from app.auth.jwt import _ALGORITHM, _ISSUER, create_access_token, decode_token
from app.config import get_settings


# ---------------------------------------------------------------------------
# create_access_token
# ---------------------------------------------------------------------------


def test_create_access_token_returns_string():
    token = create_access_token("user-123", "user@example.com", "user")
    assert isinstance(token, str)
    assert len(token) > 0


def test_create_access_token_payload_sub():
    token = create_access_token("user-abc", "user@example.com", "user")
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["sub"] == "user-abc"


def test_create_access_token_payload_email():
    token = create_access_token("user-abc", "hello@test.com", "admin")
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["email"] == "hello@test.com"


def test_create_access_token_payload_role():
    token = create_access_token("user-abc", "hello@test.com", "super_admin")
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["role"] == "super_admin"


def test_create_access_token_payload_issuer():
    token = create_access_token("uid", "a@b.com", "user")
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["iss"] == _ISSUER


def test_create_access_token_payload_has_jti():
    token = create_access_token("uid", "a@b.com", "user")
    claims = jose_jwt.get_unverified_claims(token)
    assert "jti" in claims
    # jti must be a valid UUID4 string
    parsed = uuid.UUID(claims["jti"])
    assert parsed.version == 4


def test_create_access_token_jti_is_unique():
    """Two tokens for the same user must carry different jti values."""
    t1 = create_access_token("uid", "a@b.com", "user")
    t2 = create_access_token("uid", "a@b.com", "user")
    c1 = jose_jwt.get_unverified_claims(t1)
    c2 = jose_jwt.get_unverified_claims(t2)
    assert c1["jti"] != c2["jti"]


def test_create_access_token_exp_in_future():
    before = int(time.time())
    token = create_access_token("uid", "a@b.com", "user")
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["exp"] > before


def test_create_access_token_exp_within_configured_window():
    settings = get_settings()
    before = int(time.time())
    token = create_access_token("uid", "a@b.com", "user")
    claims = jose_jwt.get_unverified_claims(token)
    expected_exp = before + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    # Allow 5-second clock drift
    assert abs(claims["exp"] - expected_exp) < 5


def test_create_access_token_uses_hs256_algorithm():
    token = create_access_token("uid", "a@b.com", "user")
    header = jose_jwt.get_unverified_header(token)
    assert header["alg"] == _ALGORITHM


# ---------------------------------------------------------------------------
# decode_token — happy path
# ---------------------------------------------------------------------------


def test_decode_token_returns_dict_for_valid_token():
    token = create_access_token("uid-1", "u@example.com", "user")
    payload = decode_token(token)
    assert isinstance(payload, dict)


def test_decode_token_correct_sub():
    token = create_access_token("uid-42", "u@example.com", "user")
    payload = decode_token(token)
    assert payload["sub"] == "uid-42"


def test_decode_token_correct_email():
    token = create_access_token("uid-42", "verified@example.com", "admin")
    payload = decode_token(token)
    assert payload["email"] == "verified@example.com"


def test_decode_token_correct_role():
    token = create_access_token("uid-42", "u@example.com", "super_admin")
    payload = decode_token(token)
    assert payload["role"] == "super_admin"


def test_decode_token_correct_issuer():
    token = create_access_token("uid-42", "u@example.com", "user")
    payload = decode_token(token)
    assert payload["iss"] == _ISSUER


def test_decode_token_jti_present():
    token = create_access_token("uid-42", "u@example.com", "user")
    payload = decode_token(token)
    assert "jti" in payload
    uuid.UUID(payload["jti"])  # must be valid UUID string


# ---------------------------------------------------------------------------
# decode_token — error paths
# ---------------------------------------------------------------------------


def test_decode_token_raises_on_tampered_signature():
    token = create_access_token("uid", "u@example.com", "user")
    # Replace the signature segment (third JWT part) with junk bytes
    header, payload, _ = token.split(".")
    import base64
    bad_sig = base64.urlsafe_b64encode(b"X" * 32).rstrip(b"=").decode()
    tampered = f"{header}.{payload}.{bad_sig}"
    with pytest.raises(ValueError, match="Invalid token"):
        decode_token(tampered)


def test_decode_token_raises_on_wrong_secret():
    """A token signed with a different secret must be rejected."""
    settings = get_settings()
    payload = {
        "sub": "uid",
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iss": _ISSUER,
        "jti": str(uuid.uuid4()),
    }
    evil_token = jose_jwt.encode(payload, "totally-wrong-secret", algorithm=_ALGORITHM)
    with pytest.raises(ValueError, match="Invalid token"):
        decode_token(evil_token)


def test_decode_token_raises_on_expired_token():
    settings = get_settings()
    payload = {
        "sub": "uid",
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        "iss": _ISSUER,
        "jti": str(uuid.uuid4()),
    }
    expired_token = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=_ALGORITHM)
    with pytest.raises(ValueError, match="Invalid token"):
        decode_token(expired_token)


def test_decode_token_raises_on_wrong_issuer():
    """Token with iss='portfolioiq-internal' must be rejected by decode_token."""
    settings = get_settings()
    payload = {
        "sub": "uid",
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iss": "portfolioiq-internal",  # wrong issuer — cross-token attack
        "jti": str(uuid.uuid4()),
    }
    cross_token = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=_ALGORITHM)
    with pytest.raises(ValueError, match="Invalid token issuer"):
        decode_token(cross_token)


def test_decode_token_raises_on_missing_issuer():
    """Token without iss claim must be rejected."""
    settings = get_settings()
    payload = {
        "sub": "uid",
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "jti": str(uuid.uuid4()),
    }
    no_iss_token = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=_ALGORITHM)
    with pytest.raises(ValueError, match="Invalid token issuer"):
        decode_token(no_iss_token)


def test_decode_token_raises_on_garbage_input():
    with pytest.raises(ValueError):
        decode_token("not.a.valid.jwt")


def test_decode_token_raises_on_empty_string():
    with pytest.raises(ValueError):
        decode_token("")
