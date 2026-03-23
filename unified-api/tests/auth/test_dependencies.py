"""Unit tests for app.auth.dependencies — cookie-based JWT dependency injection."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import create_access_token
from tests.auth.conftest import _make_user, make_mock_db


# ---------------------------------------------------------------------------
# Helpers — build minimal apps per test scenario
# ---------------------------------------------------------------------------


def _build_app_with_user(user=None, *, no_user: bool = False):
    """Return (app, db_mock) for dependency tests with a /me probe endpoint."""
    from app.auth.dependencies import get_current_user
    from app.database import get_db

    return_user = None if no_user else (user or _make_user())
    db = make_mock_db(return_user=return_user)

    app = FastAPI()

    async def _db_override():
        yield db

    app.dependency_overrides[get_db] = _db_override

    @app.get("/me")
    async def _me(current_user=None):
        from fastapi import Depends
        return {"id": str(current_user.id), "role": current_user.role}

    # Wire the dependency manually on the probe route
    from fastapi import Depends

    @app.get("/probe")
    async def _probe(current_user=Depends(get_current_user)):
        return {"id": str(current_user.id), "role": current_user.role}

    return app, db


def _build_role_app(user=None, *, no_user: bool = False, min_role: str = "admin"):
    """Return an app with a role-protected /admin probe endpoint."""
    from app.auth.dependencies import require_role
    from app.database import get_db

    return_user = user or _make_user()
    db = make_mock_db(return_user=return_user)

    app = FastAPI()

    async def _db_override():
        yield db

    app.dependency_overrides[get_db] = _db_override

    from fastapi import Depends

    @app.get("/admin")
    async def _admin(current_user=Depends(require_role(min_role))):
        return {"id": str(current_user.id), "role": current_user.role}

    return app, db


# ---------------------------------------------------------------------------
# get_current_user — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_current_user_succeeds_with_valid_cookie():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_app_with_user(user)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/probe", cookies={"access_token": token})
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


# ---------------------------------------------------------------------------
# get_current_user — 401 scenarios
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_token_has_no_sub():
    """A token without a 'sub' claim must be rejected with 401."""
    from datetime import datetime, timedelta, timezone

    from jose import jwt as jose_jwt

    from app.auth.jwt import _ALGORITHM, _ISSUER
    from app.config import get_settings

    settings = get_settings()
    # Build a valid-signature token but with no 'sub' field
    import uuid
    payload = {
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iss": _ISSUER,
        "jti": str(uuid.uuid4()),
        # 'sub' intentionally omitted
    }
    no_sub_token = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=_ALGORITHM)

    app, _ = _build_app_with_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/probe", cookies={"access_token": no_sub_token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_no_cookie():
    app, _ = _build_app_with_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/probe")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_on_invalid_token():
    app, _ = _build_app_with_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/probe", cookies={"access_token": "bad.token.value"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_token_has_no_jti():
    """A token without a 'jti' claim must be rejected with 401 (required for revocation)."""
    from datetime import datetime, timedelta, timezone

    from jose import jwt as jose_jwt

    from app.auth.jwt import _ALGORITHM, _ISSUER
    from app.config import get_settings

    settings = get_settings()
    payload = {
        "sub": str(uuid.uuid4()),
        "email": "u@example.com",
        "role": "user",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "iss": _ISSUER,
        # 'jti' intentionally omitted
    }
    no_jti_token = jose_jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=_ALGORITHM)

    app, _ = _build_app_with_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/probe", cookies={"access_token": no_jti_token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_token_blocklisted():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_app_with_user(user)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=True):
            resp = await client.get("/probe", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_user_not_in_db():
    user = _make_user()
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_app_with_user(no_user=True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/probe", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_when_user_inactive():
    user = _make_user(is_active=False)
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_app_with_user(user)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/probe", cookies={"access_token": token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_raises_401_with_internal_token():
    """Cross-token attack: internal token must not work as user auth."""
    from app.auth.jwt_utils import create_internal_token

    internal_token = create_internal_token({"service": "test"})
    app, _ = _build_app_with_user()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/probe", cookies={"access_token": internal_token})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# require_role — ROLE_HIERARCHY enforcement
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_require_admin_raises_403_for_user_role():
    user = _make_user(role="user")
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_role_app(user=user, min_role="admin")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/admin", cookies={"access_token": token})
    assert resp.status_code == 403
    assert "insufficient" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_require_admin_allows_admin_role():
    user = _make_user(role="admin")
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_role_app(user=user, min_role="admin")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/admin", cookies={"access_token": token})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_admin_allows_super_admin_role():
    user = _make_user(role="super_admin")
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_role_app(user=user, min_role="admin")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/admin", cookies={"access_token": token})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_super_admin_raises_403_for_admin_role():
    user = _make_user(role="admin")
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_role_app(user=user, min_role="super_admin")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/admin", cookies={"access_token": token})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_require_user_role_allows_any_authenticated_user():
    user = _make_user(role="user")
    token = create_access_token(str(user.id), user.email, user.role)
    app, _ = _build_role_app(user=user, min_role="user")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.auth.dependencies.is_token_blocked", new_callable=AsyncMock, return_value=False):
            resp = await client.get("/admin", cookies={"access_token": token})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# ROLE_HIERARCHY constant
# ---------------------------------------------------------------------------


def test_role_hierarchy_values():
    from app.auth.dependencies import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["user"] < ROLE_HIERARCHY["admin"]
    assert ROLE_HIERARCHY["admin"] < ROLE_HIERARCHY["super_admin"]


def test_role_hierarchy_has_expected_roles():
    from app.auth.dependencies import ROLE_HIERARCHY

    assert set(ROLE_HIERARCHY.keys()) >= {"user", "admin", "super_admin"}


# ---------------------------------------------------------------------------
# verify_portfolio_owner
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_portfolio_owner_returns_portfolio_when_owner():
    from app.auth.dependencies import verify_portfolio_owner

    user = _make_user()
    portfolio = MagicMock()
    portfolio.user_id = user.id

    db = AsyncMock()
    db.get = AsyncMock(return_value=portfolio)

    result = await verify_portfolio_owner(user.id, user, db)
    assert result is portfolio


@pytest.mark.asyncio
async def test_verify_portfolio_owner_raises_404_when_not_found():
    from fastapi import HTTPException

    from app.auth.dependencies import verify_portfolio_owner

    user = _make_user()
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await verify_portfolio_owner(user.id, user, db)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_verify_portfolio_owner_raises_403_when_not_owner():
    from fastapi import HTTPException

    from app.auth.dependencies import verify_portfolio_owner

    user = _make_user()
    other_user_id = uuid.uuid4()

    portfolio = MagicMock()
    portfolio.user_id = other_user_id  # different owner

    db = AsyncMock()
    db.get = AsyncMock(return_value=portfolio)

    with pytest.raises(HTTPException) as exc_info:
        await verify_portfolio_owner(user.id, user, db)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_portfolio_owner_accepts_string_portfolio_id():
    """portfolio_id can be passed as a string UUID and must be coerced."""
    from app.auth.dependencies import verify_portfolio_owner

    user = _make_user()
    portfolio = MagicMock()
    portfolio.user_id = user.id

    db = AsyncMock()
    db.get = AsyncMock(return_value=portfolio)

    # Pass portfolio_id as string, not UUID
    result = await verify_portfolio_owner(str(user.id), user, db)
    assert result is portfolio
