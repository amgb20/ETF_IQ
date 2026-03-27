"""Auth0 Management API v2 — async client.

Provides user CRUD via the Auth0 Management API with cached bearer tokens.

Prerequisites
-------------
1. Create a **Machine to Machine** application in the Auth0 dashboard.
2. Authorize it for the **Auth0 Management API** with scopes:
   ``read:users``, ``create:users``, ``update:users``, ``delete:users``.
3. Set ``AUTH0_MGMT_CLIENT_ID`` and ``AUTH0_MGMT_CLIENT_SECRET`` in your
   environment (separate from the user-facing application credentials).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import httpx
from jose import jwt

logger = logging.getLogger(__name__)

_mgmt_token: Optional[str] = None
_mgmt_token_expires_at: float = 0.0
_mgmt_lock: asyncio.Lock = asyncio.Lock()


def _fetch_management_token() -> Optional[dict]:
    """Synchronous token fetch — run via ``asyncio.to_thread``."""
    from app.config import get_settings

    settings = get_settings()

    if not settings.AUTH0_MGMT_CLIENT_ID or not settings.AUTH0_MGMT_CLIENT_SECRET:
        logger.warning("AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET not configured.")
        return None

    resp = httpx.post(
        f"https://{settings.AUTH0_DOMAIN}/oauth/token",
        json={
            "client_id": settings.AUTH0_MGMT_CLIENT_ID,
            "client_secret": settings.AUTH0_MGMT_CLIENT_SECRET,
            "audience": f"https://{settings.AUTH0_DOMAIN}/api/v2/",
            "grant_type": "client_credentials",
        },
        timeout=15,
    )

    if resp.status_code != 200:
        logger.error("Auth0 management token request failed: %s %s", resp.status_code, resp.text)
        return None

    return resp.json()


async def _get_management_token() -> Optional[str]:
    """Return a cached Management API bearer token, refreshing when near expiry."""
    global _mgmt_token, _mgmt_token_expires_at

    if _mgmt_token and time.time() < (_mgmt_token_expires_at - 30):
        return _mgmt_token

    async with _mgmt_lock:
        if _mgmt_token and time.time() < (_mgmt_token_expires_at - 30):
            return _mgmt_token

        token_data = await asyncio.to_thread(_fetch_management_token)
        if not token_data:
            logger.warning("Unable to obtain Auth0 management token.")
            return None

        access_token = token_data.get("access_token")
        if not access_token:
            logger.error("Auth0 token response missing access_token.")
            return None

        expires_in = token_data.get("expires_in", 3600)
        _mgmt_token_expires_at = time.time() + expires_in
        _mgmt_token = access_token

        try:
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            logger.debug("Management token scopes: %s", decoded.get("scope", ""))
        except Exception:
            pass

        logger.info("Auth0 management token refreshed (expires_in=%ds)", expires_in)
        return _mgmt_token


async def _mgmt_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Execute an authenticated request against the Management API v2.

    Returns the raw ``httpx.Response`` so callers can inspect status codes.
    """
    from app.config import get_settings

    token = await _get_management_token()
    if not token:
        raise RuntimeError("Auth0 Management API token unavailable — check MGMT credentials.")

    settings = get_settings()
    base_url = f"https://{settings.AUTH0_DOMAIN}/api/v2"

    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method,
            f"{base_url}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
            **kwargs,
        )

    return resp


async def create_auth0_user(email: str, name: str | None = None) -> Optional[dict]:
    """Create a passwordless (email connection) user in Auth0.

    Returns the Auth0 user dict on success, or the existing user if already
    registered.  Returns ``None`` only if the management client is unavailable.
    """
    user_data: dict = {
        "email": email,
        "connection": "email",
        "email_verified": True,
    }
    if name:
        user_data["name"] = name

    logger.info("Creating Auth0 user for email: %s", email)

    try:
        resp = await _mgmt_request("POST", "/users", json=user_data)
    except RuntimeError:
        logger.warning("Auth0 Management client not available. Skipping Auth0 user creation.")
        return None

    if resp.status_code in (200, 201):
        user = resp.json()
        logger.info("Successfully created Auth0 user: %s", user.get("user_id"))
        return user

    if resp.status_code == 409 or "already exists" in resp.text.lower():
        logger.info("User %s already exists in Auth0, fetching existing record", email)
        return await _get_user_by_email(email)

    logger.error("Auth0 error creating user %s: %s %s", email, resp.status_code, resp.text)
    raise RuntimeError(f"Auth0 user creation failed: {resp.status_code} {resp.text}")


async def _get_user_by_email(email: str) -> Optional[dict]:
    """Look up an Auth0 user by email."""
    try:
        resp = await _mgmt_request("GET", "/users-by-email", params={"email": email})
    except RuntimeError:
        return None

    if resp.status_code == 200:
        users = resp.json()
        if users:
            return users[0]
    return None


async def get_auth0_user(auth0_id: str) -> dict:
    """Fetch a user record from Auth0 by their ``user_id``."""
    resp = await _mgmt_request("GET", f"/users/{auth0_id}")
    if resp.status_code >= 400:
        raise RuntimeError(f"Auth0 GET /users/{auth0_id} failed: {resp.status_code} {resp.text}")
    return resp.json()


async def disable_auth0_user(auth0_id: str) -> None:
    """Block a user in Auth0 (they cannot log in until re-enabled)."""
    resp = await _mgmt_request("PATCH", f"/users/{auth0_id}", json={"blocked": True})
    if resp.status_code >= 400:
        raise RuntimeError(f"Auth0 disable user failed: {resp.status_code} {resp.text}")
    logger.info("Auth0: disabled user %s", auth0_id)


async def enable_auth0_user(auth0_id: str) -> None:
    """Unblock a previously disabled Auth0 user."""
    resp = await _mgmt_request("PATCH", f"/users/{auth0_id}", json={"blocked": False})
    if resp.status_code >= 400:
        raise RuntimeError(f"Auth0 enable user failed: {resp.status_code} {resp.text}")
    logger.info("Auth0: enabled user %s", auth0_id)
