"""Auth0 Management API v2 — async client.

This module is a building block for admin user management.  It is not wired
into any router yet; import and call its functions when you need to create,
disable, or look up users in Auth0 from the backend.

Prerequisites
-------------
1. Create a **Machine to Machine** application in the Auth0 dashboard.
2. Authorize it for the **Auth0 Management API** with scopes:
   ``read:users``, ``create:users``, ``update:users``.
3. Set ``AUTH0_MGMT_CLIENT_ID`` and ``AUTH0_MGMT_CLIENT_SECRET`` in your
   environment (separate from the user-facing application credentials).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# Simple in-process cache for the management token.
_mgmt_token: Optional[str] = None
_mgmt_token_expires_at: float = 0.0
_TOKEN_BUFFER_SECONDS: int = 60  # Refresh this many seconds before real expiry.
_mgmt_token_lock: asyncio.Lock = asyncio.Lock()


async def _get_management_token() -> str:
    """Return a valid Management API bearer token, refreshing when needed.

    Uses an asyncio.Lock to prevent simultaneous token refresh requests under
    concurrent admin operations (TOCTOU race on the module-level cache).
    """
    global _mgmt_token, _mgmt_token_expires_at

    # Fast path: valid cached token — skip the lock entirely.
    if _mgmt_token and time.monotonic() < (_mgmt_token_expires_at - _TOKEN_BUFFER_SECONDS):
        return _mgmt_token

    async with _mgmt_token_lock:
        # Double-check after acquiring the lock — another coroutine may have
        # already refreshed the token while we were waiting.
        if _mgmt_token and time.monotonic() < (_mgmt_token_expires_at - _TOKEN_BUFFER_SECONDS):
            return _mgmt_token

        from app.config import get_settings
        settings = get_settings()

        if not settings.AUTH0_MGMT_CLIENT_ID or not settings.AUTH0_MGMT_CLIENT_SECRET:
            raise RuntimeError(
                "AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET must be set "
                "to use the Auth0 Management API."
            )

        audience = f"https://{settings.AUTH0_DOMAIN}/api/v2/"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://{settings.AUTH0_DOMAIN}/oauth/token",
                json={
                    "client_id": settings.AUTH0_MGMT_CLIENT_ID,
                    "client_secret": settings.AUTH0_MGMT_CLIENT_SECRET,
                    "audience": audience,
                    "grant_type": "client_credentials",
                },
                timeout=15,
            )

        if resp.status_code != 200:
            raise RuntimeError(
                f"Failed to obtain Auth0 Management token: {resp.status_code} {resp.text}"
            )

        data = resp.json()
        _mgmt_token = data["access_token"]
        _mgmt_token_expires_at = time.monotonic() + data.get("expires_in", 86400)
        logger.info("Auth0 management token refreshed (expires_in=%ds)", data.get("expires_in"))
        return _mgmt_token


async def _mgmt_request(method: str, path: str, **kwargs: Any) -> dict:
    """Execute an authenticated request against the Management API v2."""
    from app.config import get_settings
    settings = get_settings()
    token = await _get_management_token()
    base_url = f"https://{settings.AUTH0_DOMAIN}/api/v2"

    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method,
            f"{base_url}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
            **kwargs,
        )

    if resp.status_code >= 400:
        raise RuntimeError(
            f"Auth0 Management API {method} {path} failed: {resp.status_code} {resp.text}"
        )

    # 204 No Content responses have no body.
    return resp.json() if resp.content else {}


async def get_auth0_user(auth0_id: str) -> dict:
    """Fetch a user record from Auth0 by their user_id (e.g. ``email|abc123``)."""
    return await _mgmt_request("GET", f"/users/{auth0_id}")


async def create_auth0_user(email: str) -> dict:
    """Create a passwordless (email connection) user in Auth0.

    Returns the created user dict including the Auth0 ``user_id``.
    """
    return await _mgmt_request(
        "POST",
        "/users",
        json={
            "connection": "email",
            "email": email,
            "email_verified": False,
        },
    )


async def disable_auth0_user(auth0_id: str) -> None:
    """Block a user in Auth0 (they cannot log in until re-enabled)."""
    await _mgmt_request("PATCH", f"/users/{auth0_id}", json={"blocked": True})
    logger.info("Auth0: disabled user %s", auth0_id)


async def enable_auth0_user(auth0_id: str) -> None:
    """Unblock a previously disabled Auth0 user."""
    await _mgmt_request("PATCH", f"/users/{auth0_id}", json={"blocked": False})
    logger.info("Auth0: enabled user %s", auth0_id)
