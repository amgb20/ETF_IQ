"""FastAPI auth dependencies — cookie-based internal JWT validation."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User

from .jwt import decode_token

logger = logging.getLogger(__name__)

ROLE_HIERARCHY = {"user": 0, "admin": 1, "super_admin": 2}


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Read the HttpOnly access_token cookie and return the DB user."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account disabled",
        )

    return user


def require_role(min_role: str):
    """Return a dependency that enforces a minimum role level."""
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    async def _check(user: User = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(user.role, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check


RequireAuth = Annotated[User, Depends(get_current_user)]


async def verify_portfolio_owner(
    portfolio_id,
    user: User,
    db: AsyncSession,
):
    """Load a portfolio and verify the current user owns it. Returns the portfolio or raises 403."""
    import uuid

    from app.models import Portfolio

    pid = portfolio_id if isinstance(portfolio_id, uuid.UUID) else uuid.UUID(str(portfolio_id))
    portfolio = await db.get(Portfolio, pid)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found",
        )
    if portfolio.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return portfolio
