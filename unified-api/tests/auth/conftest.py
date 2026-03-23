"""Shared fixtures for auth test suite.

All external dependencies (Redis, Auth0 HTTP, PostgreSQL) are mocked so tests
run fully offline without any infrastructure.
"""

from __future__ import annotations

import uuid
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Settings override — must happen before any app.config import resolves the
# lru_cache so tests get predictable, non-secret values.
# ---------------------------------------------------------------------------

TEST_JWT_SECRET = "test-secret-key-that-is-long-enough-32ch"
TEST_AUTH0_DOMAIN = "test.auth0.com"
TEST_AUTH0_CLIENT_ID = "test-client-id"
TEST_AUTH0_CLIENT_SECRET = "test-client-secret"


@pytest.fixture(autouse=True)
def override_settings(monkeypatch):
    """Patch get_settings() so every test gets deterministic config values
    without touching the real .env file or lru_cache."""
    from app import config as config_module

    # Clear lru_cache so a fresh Settings() is built with our env vars.
    config_module.get_settings.cache_clear()

    monkeypatch.setenv("JWT_SECRET_KEY", TEST_JWT_SECRET)
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    monkeypatch.setenv("AUTH0_DOMAIN", TEST_AUTH0_DOMAIN)
    monkeypatch.setenv("AUTH0_CLIENT_ID", TEST_AUTH0_CLIENT_ID)
    monkeypatch.setenv("AUTH0_CLIENT_SECRET", TEST_AUTH0_CLIENT_SECRET)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("USE_REDIS", "true")
    monkeypatch.setenv("PERSIST_AUDIT_LOG", "false")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

    yield

    # Re-clear so subsequent test modules start clean.
    config_module.get_settings.cache_clear()


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------

USER_ID = uuid.uuid4()
ADMIN_ID = uuid.uuid4()


def _make_user(
    user_id: uuid.UUID = USER_ID,
    email: str = "user@example.com",
    role: str = "user",
    is_active: bool = True,
    display_name: str | None = None,
    auth0_id: str | None = None,
) -> MagicMock:
    """Return a MagicMock that quacks like a User ORM object."""
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.role = role
    user.is_active = is_active
    user.display_name = display_name
    user.auth0_id = auth0_id
    return user


@pytest.fixture
def mock_user() -> MagicMock:
    """Active regular user."""
    return _make_user()


@pytest.fixture
def mock_admin_user() -> MagicMock:
    """Active admin user."""
    return _make_user(user_id=ADMIN_ID, email="admin@example.com", role="admin")


@pytest.fixture
def mock_super_admin_user() -> MagicMock:
    """Active super_admin user."""
    return _make_user(
        user_id=uuid.uuid4(),
        email="superadmin@example.com",
        role="super_admin",
    )


@pytest.fixture
def mock_inactive_user() -> MagicMock:
    """Inactive (disabled) user."""
    return _make_user(is_active=False)


# ---------------------------------------------------------------------------
# Token fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def valid_token(mock_user) -> str:
    """A freshly-minted user JWT for mock_user."""
    from app.auth.jwt import create_access_token

    return create_access_token(
        user_id=str(mock_user.id),
        email=mock_user.email,
        role=mock_user.role,
    )


@pytest.fixture
def admin_token(mock_admin_user) -> str:
    from app.auth.jwt import create_access_token

    return create_access_token(
        user_id=str(mock_admin_user.id),
        email=mock_admin_user.email,
        role=mock_admin_user.role,
    )


@pytest.fixture
def internal_token() -> str:
    """A freshly-minted internal service JWT."""
    from app.auth.jwt_utils import create_internal_token

    return create_internal_token({"service": "test-service"}, expires_minutes=5)


# ---------------------------------------------------------------------------
# Async DB session mock
# ---------------------------------------------------------------------------


def make_mock_db(return_user=None) -> AsyncMock:
    """Build a minimal async SQLAlchemy session mock.

    ``return_user`` sets the value returned by scalar_one_or_none() on any
    ``execute()`` call, which is how routers and dependencies fetch the user.
    """
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = return_user

    session = AsyncMock()
    session.execute = AsyncMock(return_value=mock_result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


# ---------------------------------------------------------------------------
# Minimal FastAPI test application (no main.py lifespan / secret checks)
# ---------------------------------------------------------------------------


def build_test_app(db_override: AsyncMock | None = None) -> FastAPI:
    """Return a minimal FastAPI app that mounts only the auth router.

    Avoids importing app.main (which calls _check_secrets() + sys.exit at
    module level) and the data_connectors scheduler.
    """
    from app.auth.router import router as auth_router
    from app.database import get_db

    test_app = FastAPI()
    test_app.include_router(auth_router)

    if db_override is not None:

        async def _override_db():
            yield db_override

        test_app.dependency_overrides[get_db] = _override_db

    return test_app


@pytest.fixture
def db_session(mock_user) -> AsyncMock:
    """Default DB session that returns mock_user on every query."""
    return make_mock_db(return_user=mock_user)


@pytest.fixture
async def auth_client(db_session) -> AsyncIterator[AsyncClient]:
    """AsyncClient wired to the minimal test app with a mocked DB."""
    app = build_test_app(db_override=db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
