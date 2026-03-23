"""Integration tests for app.auth.router — all endpoints via AsyncClient.

External dependencies (Auth0 HTTP, Redis, PostgreSQL) are fully mocked.
The test app is built from app.auth.router alone — app.main is never imported.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import create_access_token
from tests.auth.conftest import _make_user, make_mock_db

# ---------------------------------------------------------------------------
# App / client builders
# ---------------------------------------------------------------------------


def _make_client_with_user(user=None, *, no_user: bool = False):
    """Build a test AsyncClient whose DB always returns ``user``."""
    from fastapi import FastAPI

    from app.auth.router import router as auth_router
    from app.database import get_db

    return_user = None if no_user else (user or _make_user())
    db = make_mock_db(return_user=return_user)

    app = FastAPI()
    app.include_router(auth_router)

    async def _db_override():
        yield db

    app.dependency_overrides[get_db] = _db_override
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test"), db


# ---------------------------------------------------------------------------
# POST /auth/login/passwordless/start
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_returns_200_on_success():
    client, _ = _make_client_with_user()
    async with client:
        with patch("app.auth.router.check_start_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.start_passwordless", new_callable=AsyncMock):
                resp = await client.post("/auth/login/passwordless/start", json={"email": "user@example.com"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_start_returns_429_when_rate_limit_exceeded():
    from fastapi import HTTPException, status

    client, _ = _make_client_with_user()
    async with client:
        with patch(
            "app.auth.router.check_start_rate_limit",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts"),
        ):
            resp = await client.post("/auth/login/passwordless/start", json={"email": "user@example.com"})
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_start_returns_400_on_auth0_value_error():
    """Auth0 returning an error propagates as HTTP 400."""
    client, _ = _make_client_with_user()
    async with client:
        with patch("app.auth.router.check_start_rate_limit", new_callable=AsyncMock):
            with patch(
                "app.auth.router.start_passwordless",
                new_callable=AsyncMock,
                side_effect=ValueError("Failed to send OTP (Auth0 400)"),
            ):
                resp = await client.post("/auth/login/passwordless/start", json={"email": "user@example.com"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_returns_422_on_invalid_email():
    """Pydantic EmailStr validation must reject garbage emails."""
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.post("/auth/login/passwordless/start", json={"email": "not-an-email"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_start_returns_500_on_unexpected_exception():
    """Non-ValueError exception from start_passwordless → HTTP 500."""
    client, _ = _make_client_with_user()
    async with client:
        with patch("app.auth.router.check_start_rate_limit", new_callable=AsyncMock):
            with patch(
                "app.auth.router.start_passwordless",
                new_callable=AsyncMock,
                side_effect=RuntimeError("unexpected failure"),
            ):
                resp = await client.post("/auth/login/passwordless/start", json={"email": "user@example.com"})
    assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /auth/login/passwordless/verify
# ---------------------------------------------------------------------------


FAKE_CLAIMS = {"sub": "auth0|abc123", "email": "user@example.com"}


@pytest.mark.asyncio
async def test_verify_returns_200_and_sets_cookies():
    user = _make_user()
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.verify_passwordless", new_callable=AsyncMock, return_value=FAKE_CLAIMS):
                with patch("app.auth.router.reset_otp_rate_limit", new_callable=AsyncMock):
                    with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                        resp = await client.post(
                            "/auth/login/passwordless/verify",
                            json={"email": "user@example.com", "code": "123456"},
                        )
    assert resp.status_code == 200
    assert "access_token" in resp.cookies
    assert "access_token_js" in resp.cookies


@pytest.mark.asyncio
async def test_verify_returns_user_dict():
    user = _make_user(display_name="Alice")
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.verify_passwordless", new_callable=AsyncMock, return_value=FAKE_CLAIMS):
                with patch("app.auth.router.reset_otp_rate_limit", new_callable=AsyncMock):
                    with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                        resp = await client.post(
                            "/auth/login/passwordless/verify",
                            json={"email": "user@example.com", "code": "123456"},
                        )
    data = resp.json()
    assert data["success"] is True
    assert "user" in data
    assert data["user"]["email"] == user.email
    assert data["user"]["role"] == user.role


@pytest.mark.asyncio
async def test_verify_returns_401_on_invalid_otp():
    client, _ = _make_client_with_user()
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch(
                "app.auth.router.verify_passwordless",
                new_callable=AsyncMock,
                side_effect=ValueError("Invalid or expired OTP code"),
            ):
                with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                    resp = await client.post(
                        "/auth/login/passwordless/verify",
                        json={"email": "user@example.com", "code": "000000"},
                    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_returns_403_when_email_not_in_db():
    """Email verified by Auth0 but not in our DB → 403 Forbidden."""
    client, _ = _make_client_with_user(no_user=True)
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.verify_passwordless", new_callable=AsyncMock, return_value=FAKE_CLAIMS):
                with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                    resp = await client.post(
                        "/auth/login/passwordless/verify",
                        json={"email": "user@example.com", "code": "123456"},
                    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_verify_returns_403_when_user_inactive():
    """Disabled user must be rejected with 403."""
    user = _make_user(is_active=False)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.verify_passwordless", new_callable=AsyncMock, return_value=FAKE_CLAIMS):
                with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                    resp = await client.post(
                        "/auth/login/passwordless/verify",
                        json={"email": "user@example.com", "code": "123456"},
                    )
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_verify_returns_429_when_otp_limit_exceeded():
    from fastapi import HTTPException, status

    client, _ = _make_client_with_user()
    async with client:
        with patch(
            "app.auth.router.check_otp_rate_limit",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts"),
        ):
            resp = await client.post(
                "/auth/login/passwordless/verify",
                json={"email": "user@example.com", "code": "123456"},
            )
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_verify_resets_rate_limit_on_success():
    user = _make_user()
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.check_otp_rate_limit", new_callable=AsyncMock):
            with patch("app.auth.router.verify_passwordless", new_callable=AsyncMock, return_value=FAKE_CLAIMS):
                with patch("app.auth.router.reset_otp_rate_limit", new_callable=AsyncMock) as mock_reset:
                    with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                        await client.post(
                            "/auth/login/passwordless/verify",
                            json={"email": "user@example.com", "code": "123456"},
                        )
    mock_reset.assert_called_once()


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_returns_401_when_no_cookie():
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.post("/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_returns_200_with_valid_token():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                resp = await client.post("/auth/refresh", cookies={"access_token": token})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_refresh_sets_new_cookies():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                resp = await client.post("/auth/refresh", cookies={"access_token": token})
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_refresh_revokes_old_jti():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock) as mock_block:
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                await client.post("/auth/refresh", cookies={"access_token": token})
    mock_block.assert_called_once()


@pytest.mark.asyncio
async def test_refresh_returns_401_when_user_inactive():
    user = _make_user(is_active=False)
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            resp = await client.post("/auth/refresh", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_returns_401_when_user_not_in_db():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(no_user=True)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            resp = await client.post("/auth/refresh", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_returns_401_on_invalid_token():
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.post("/auth/refresh", cookies={"access_token": "garbage.token.value"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_returns_401_when_token_blocklisted():
    """A revoked token must not be accepted by /refresh."""
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.is_token_blocked", new_callable=AsyncMock, return_value=True):
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                resp = await client.post("/auth/refresh", cookies={"access_token": token})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_returns_200_with_cookie():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                resp = await client.post("/auth/logout", cookies={"access_token": token})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


@pytest.mark.asyncio
async def test_logout_returns_200_without_cookie():
    """Logout with no cookie must still succeed (idempotent)."""
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.post("/auth/logout")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_logout_calls_block_token():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock) as mock_block:
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                await client.post("/auth/logout", cookies={"access_token": token})
    mock_block.assert_called_once()


@pytest.mark.asyncio
async def test_logout_clears_access_token_cookie():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.router.block_token", new_callable=AsyncMock):
            with patch("app.auth.router.log_auth_event", new_callable=AsyncMock):
                resp = await client.post("/auth/logout", cookies={"access_token": token})
    # After logout, the set-cookie header should clear the cookie (max-age=0 or expires in past)
    set_cookie_headers = (
        resp.headers.get_list("set-cookie")
        if hasattr(resp.headers, "get_list")
        else [v for k, v in resp.headers.items() if k.lower() == "set-cookie"]
    )
    cookie_names = " ".join(set_cookie_headers)
    assert "access_token" in cookie_names


@pytest.mark.asyncio
async def test_logout_handles_unparseable_token_gracefully():
    """If the cookie is garbage that jose cannot parse, logout must still return 200."""
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.post("/auth/logout", cookies={"access_token": "totally.garbage.token"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


# ---------------------------------------------------------------------------
# GET /auth/get-auth-role
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_auth_role_returns_200_when_authenticated():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/auth/get-auth-role", cookies={"access_token": token})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_auth_role_returns_user_data():
    user = _make_user(display_name="Alice")
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/auth/get-auth-role", cookies={"access_token": token})
    data = resp.json()
    assert data["email"] == user.email
    assert data["role"] == user.role


@pytest.mark.asyncio
async def test_get_auth_role_returns_401_with_no_cookie():
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.get("/auth/get-auth-role")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_auth_role_returns_401_with_invalid_token():
    client, _ = _make_client_with_user()
    async with client:
        resp = await client.get("/auth/get-auth-role", cookies={"access_token": "invalid.token.here"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_auth_role_returns_401_when_token_blocklisted():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=True):
            resp = await client.get("/auth/get-auth-role", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_auth_role_returns_401_when_user_inactive():
    user = _make_user(is_active=False)
    token = create_access_token(str(user.id), user.email, user.role)
    client, _ = _make_client_with_user(user)
    async with client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/auth/get-auth-role", cookies={"access_token": token})
    assert resp.status_code == 401
