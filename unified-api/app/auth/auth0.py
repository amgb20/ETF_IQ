"""Auth0 API integration — passwordless email OTP flow."""

import logging

import httpx
from jose import jwt as jose_jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

_JWKS_CACHE: list = []


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


async def _get_jwks() -> list:
    """Fetch and cache Auth0's public keys (JWKS)."""
    global _JWKS_CACHE
    if _JWKS_CACHE:
        return _JWKS_CACHE
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json",
            timeout=10,
        )
    _JWKS_CACHE = resp.json().get("keys", [])
    return _JWKS_CACHE


async def _decode_auth0_token(token: str) -> dict:
    """Validate Auth0 RS256 JWT and return its claims."""
    settings = get_settings()
    keys = await _get_jwks()
    header = jose_jwt.get_unverified_header(token)
    kid = header.get("kid")

    key = next((k for k in keys if k.get("kid") == kid), None)
    if not key:
        global _JWKS_CACHE
        _JWKS_CACHE = []
        keys = await _get_jwks()
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
