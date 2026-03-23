"""Unit tests for app.auth.auth0 — Auth0 passwordless OTP flow.

All HTTP calls are mocked — no real Auth0 network access.
"""

from __future__ import annotations

import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from jose import jwt as jose_jwt

import app.auth.auth0 as auth0_module
from app.auth.auth0 import (
    _decode_auth0_token,
    _get_jwks,
    start_passwordless,
    verify_passwordless,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_httpx_response(status_code: int, json_body: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body
    resp.text = str(json_body)
    return resp


def _fake_token(alg: str, kid: str = "test-kid") -> str:
    """Create a minimal JWT with the given algorithm in its header.

    All variants are hand-crafted as base64url(header).base64url(payload).sig
    so we never need jose to actually sign with disallowed algorithms.
    The algorithm guard in _decode_auth0_token reads only the header, so the
    fake signature is never verified — but jose's _load() does validate base64
    padding on the signature segment, so we supply a valid-padding placeholder.
    """
    import base64
    import json

    def _b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    header = _b64({"alg": alg, "kid": kid, "typ": "JWT"})
    payload = _b64({"sub": "test", "iss": "https://test.auth0.com/"})
    # Valid base64url-encoded 32-zero-bytes signature placeholder
    sig = base64.urlsafe_b64encode(b"\x00" * 32).rstrip(b"=").decode()
    return f"{header}.{payload}.{sig}"


# ---------------------------------------------------------------------------
# Algorithm guard — _decode_auth0_token
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_alg_none():
    """alg=none must be rejected before any JWKS fetch."""
    token = _fake_token("none")
    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="disallowed algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_hs256():
    token = _fake_token("HS256")
    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="disallowed algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_hs384():
    token = _fake_token("HS384")
    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="disallowed algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_hs512():
    token = _fake_token("HS512")
    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="disallowed algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_case_insensitive_none():
    """Algorithm guard comparison is case-insensitive."""
    token = _fake_token("None", kid="k")

    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="disallowed algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rejects_unexpected_algorithm():
    """Any algorithm that is not RS256 (and not in rejected list) is also refused."""
    token = _fake_token("RS512", kid="k")

    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock) as mock_jwks:
        with pytest.raises(ValueError, match="unexpected algorithm"):
            await _decode_auth0_token(token)
        mock_jwks.assert_not_called()


@pytest.mark.asyncio
async def test_decode_auth0_token_rs256_proceeds_to_jwks_fetch():
    """RS256 must bypass the algorithm guard and attempt JWKS fetch."""
    token = _fake_token("RS256", kid="my-kid")

    # Patch _get_jwks to return a key list that does NOT match kid,
    # so we get a ValueError about missing key rather than algorithm rejection.
    with patch.object(
        auth0_module,
        "_get_jwks",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_jwks:
        with pytest.raises(ValueError, match="signing key not found"):
            await _decode_auth0_token(token)
        # _get_jwks must have been called (twice: initial + cache-bust retry)
        assert mock_jwks.call_count == 2


@pytest.mark.asyncio
async def test_decode_auth0_token_calls_jose_decode_when_key_found():
    """When a matching key is found in JWKS, jose_jwt.decode must be called and
    its result returned.  This exercises auth0.py line 121."""
    token = _fake_token("RS256", kid="found-kid")
    matching_key = {"kid": "found-kid", "kty": "RSA"}
    fake_claims = {"sub": "auth0|abc", "email": "u@example.com"}

    with patch.object(auth0_module, "_get_jwks", new_callable=AsyncMock, return_value=[matching_key]):
        with patch("app.auth.auth0.jose_jwt.decode", return_value=fake_claims) as mock_decode:
            result = await _decode_auth0_token(token)

    assert result == fake_claims
    mock_decode.assert_called_once()


# ---------------------------------------------------------------------------
# _get_jwks — caching behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_jwks_fetches_on_first_call():
    """First call must make an HTTP request and return keys."""
    # Reset module-level cache state
    auth0_module._JWKS_CACHE = []
    auth0_module._JWKS_CACHE_AT = 0.0

    fake_keys = [{"kid": "key-1", "kty": "RSA"}]
    mock_resp = _make_httpx_response(200, {"keys": fake_keys})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await _get_jwks()

    assert result == fake_keys
    mock_client.get.assert_called_once()


@pytest.mark.asyncio
async def test_get_jwks_returns_cache_within_ttl():
    """Subsequent calls within TTL must return cached keys without HTTP."""
    cached_keys = [{"kid": "cached-key", "kty": "RSA"}]
    auth0_module._JWKS_CACHE = cached_keys
    auth0_module._JWKS_CACHE_AT = time.monotonic()  # just fetched

    with patch("httpx.AsyncClient") as mock_client_cls:
        result = await _get_jwks()
        mock_client_cls.assert_not_called()

    assert result == cached_keys


@pytest.mark.asyncio
async def test_get_jwks_refetches_after_ttl_expires():
    """After TTL, the JWKS must be re-fetched from Auth0."""
    old_keys = [{"kid": "old-key"}]
    new_keys = [{"kid": "new-key"}]

    auth0_module._JWKS_CACHE = old_keys
    # Simulate cache set 2 hours ago (TTL is 3600 s)
    auth0_module._JWKS_CACHE_AT = time.monotonic() - 7201

    mock_resp = _make_httpx_response(200, {"keys": new_keys})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await _get_jwks()

    assert result == new_keys
    mock_client.get.assert_called_once()


# ---------------------------------------------------------------------------
# start_passwordless
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_passwordless_sends_correct_payload():
    mock_resp = _make_httpx_response(200, {})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await start_passwordless("test@example.com")

    call_kwargs = mock_client.post.call_args
    body = call_kwargs.kwargs.get("json") or call_kwargs.args[1]
    assert body["email"] == "test@example.com"
    assert body["send"] == "code"
    assert body["connection"] == "email"


@pytest.mark.asyncio
async def test_start_passwordless_raises_on_auth0_error():
    mock_resp = _make_httpx_response(400, {"error": "bad request"})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="Failed to send OTP"):
            await start_passwordless("bad@example.com")


@pytest.mark.asyncio
async def test_start_passwordless_accepts_201_response():
    """Auth0 may return 201 on some configurations — must be treated as success."""
    mock_resp = _make_httpx_response(201, {})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        # Should not raise
        await start_passwordless("ok@example.com")


# ---------------------------------------------------------------------------
# verify_passwordless
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_passwordless_raises_on_invalid_otp():
    mock_resp = _make_httpx_response(403, {"error": "invalid otp"})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="Invalid or expired OTP"):
            await verify_passwordless("user@example.com", "000000")


@pytest.mark.asyncio
async def test_verify_passwordless_raises_when_no_id_token():
    mock_resp = _make_httpx_response(200, {"access_token": "at"})  # no id_token

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="did not return an id_token"):
            await verify_passwordless("user@example.com", "123456")


@pytest.mark.asyncio
async def test_verify_passwordless_decodes_id_token():
    """When Auth0 returns a valid id_token, claims must be returned."""
    fake_claims = {"sub": "auth0|123", "email": "user@example.com"}

    mock_resp = _make_httpx_response(200, {"id_token": "fake.id.token"})

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with patch.object(auth0_module, "_decode_auth0_token", new_callable=AsyncMock, return_value=fake_claims):
            result = await verify_passwordless("user@example.com", "123456")

    assert result == fake_claims
