"""Auth0 API integration — passwordless email OTP flow."""

import asyncio
import logging
import time

import httpx
from jose import jwt as jose_jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

_JWKS_CACHE: list = []
_JWKS_CACHE_AT: float = 0.0
_JWKS_TTL_SECONDS: int = 3600  # Refresh JWKS at most once per hour
_jwks_lock: asyncio.Lock = asyncio.Lock()

# Algorithms that must never be accepted from Auth0 tokens.
_REJECTED_ALGORITHMS = {"none", "hs256", "hs384", "hs512"}


async def start_passwordless(email: str) -> None:
    """Ask Auth0 to send a 6-digit OTP code to the user's email."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{settings.AUTH0_DOMAIN}/passwordless/start",
            json={
                "client_id": settings.AUTH0_CLIENT_ID,
                "client_secret": settings.AUTH0_CLIENT_SECRET,
                "connection": "email",
                "email": email,
                "send": "code",
                "authParams": {
                    "scope": "openid profile email",
                },
            },
            timeout=15,
        )
    if resp.status_code not in (200, 201):
        logger.error("Auth0 passwordless/start failed: %s %s", resp.status_code, resp.text)
        raise ValueError(f"Failed to send OTP (Auth0 {resp.status_code})")


async def verify_passwordless(email: str, code: str) -> dict:
    """Exchange OTP for Auth0 tokens.  Returns decoded id_token claims."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{settings.AUTH0_DOMAIN}/oauth/token",
            json={
                "grant_type": "http://auth0.com/oauth/grant-type/passwordless/otp",
                "client_id": settings.AUTH0_CLIENT_ID,
                "client_secret": settings.AUTH0_CLIENT_SECRET,
                "username": email,
                "otp": code,
                "realm": "email",
                "scope": "openid profile email",
            },
            timeout=15,
        )
    if resp.status_code != 200:
        logger.error("Auth0 passwordless/verify failed: %s %s", resp.status_code, resp.text)
        raise ValueError("Invalid or expired OTP code")

    data = resp.json()
    id_token = data.get("id_token")
    if not id_token:
        raise ValueError("Auth0 did not return an id_token")

    return await _decode_auth0_token(id_token)


async def _get_jwks(*, force_refresh: bool = False) -> list:
    """Fetch and cache Auth0's public keys (JWKS) with a 1-hour TTL.

    Uses an asyncio.Lock to prevent simultaneous JWKS refreshes under
    concurrent login attempts (TOCTOU race on the module-level cache).
    """
    global _JWKS_CACHE, _JWKS_CACHE_AT
    now = time.monotonic()
    # Fast path: valid cache and no forced refresh — skip the lock entirely.
    if not force_refresh and _JWKS_CACHE and (now - _JWKS_CACHE_AT) < _JWKS_TTL_SECONDS:
        return _JWKS_CACHE

    async with _jwks_lock:
        # Double-check after acquiring the lock — another coroutine may have
        # already refreshed the cache while we were waiting.
        now = time.monotonic()
        if not force_refresh and _JWKS_CACHE and (now - _JWKS_CACHE_AT) < _JWKS_TTL_SECONDS:
            return _JWKS_CACHE

        settings = get_settings()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json",
                    timeout=10,
                )
            if resp.status_code != 200:
                logger.error("JWKS fetch failed: HTTP %s", resp.status_code)
                if _JWKS_CACHE:
                    logger.warning("JWKS fetch failed — returning stale cache")
                    return _JWKS_CACHE
                raise ValueError("Auth0 JWKS endpoint unavailable")
        except (httpx.HTTPError, OSError) as exc:
            logger.error("JWKS fetch network error: %s", exc)
            if _JWKS_CACHE:
                logger.warning("JWKS fetch failed — returning stale cache")
                return _JWKS_CACHE
            raise ValueError("Auth0 JWKS endpoint unavailable") from exc

        _JWKS_CACHE = resp.json().get("keys", [])
        _JWKS_CACHE_AT = time.monotonic()
        return _JWKS_CACHE


async def _decode_auth0_token(token: str) -> dict:
    """Validate Auth0 RS256 JWT and return its claims."""
    settings = get_settings()

    header = jose_jwt.get_unverified_header(token)

    # Algorithm confusion guard — reject anything that is not RS256.
    # This must run before any JWKS fetch or key lookup.
    alg = header.get("alg", "")
    if not alg or alg.lower() in _REJECTED_ALGORITHMS:
        logger.warning("Auth0 token rejected: disallowed algorithm '%s'", alg)
        raise ValueError(f"Rejected token: disallowed algorithm '{alg}'")
    if alg != "RS256":
        logger.warning("Auth0 token rejected: unexpected algorithm '%s'", alg)
        raise ValueError(f"Rejected token: unexpected algorithm '{alg}', expected RS256")

    kid = header.get("kid")
    keys = await _get_jwks()
    key = next((k for k in keys if k.get("kid") == kid), None)

    if not key:
        # Emergency key rotation: force a cache refresh and retry once.
        keys = await _get_jwks(force_refresh=True)
        key = next((k for k in keys if k.get("kid") == kid), None)

    if not key:
        raise ValueError("Auth0 signing key not found in JWKS")

    return jose_jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience=settings.AUTH0_CLIENT_ID,
        issuer=f"https://{settings.AUTH0_DOMAIN}/",
    )
