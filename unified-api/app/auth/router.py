"""Auth0 passwordless OTP router.

Endpoints
---------
POST /auth/login/passwordless/start   — send OTP to email
POST /auth/login/passwordless/verify  — verify OTP, issue JWT, set cookies
GET  /auth/get-auth-role              — return current user info (requires auth)
POST /auth/logout                     — clear auth cookies
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User

from .auth0 import start_passwordless, verify_passwordless
from .dependencies import get_current_user
from .jwt import create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class StartRequest(BaseModel):
    email: str


class VerifyRequest(BaseModel):
    email: str
    code: str


@router.post("/login/passwordless/start")
async def passwordless_start(body: StartRequest):
    """Send a 6-digit OTP to the provided email address via Auth0."""
    try:
        await start_passwordless(body.email)
        return {"success": True}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Passwordless start error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to send OTP") from exc


@router.post("/login/passwordless/verify")
async def passwordless_verify(
    body: VerifyRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP, look up pre-authorized user, issue internal JWT cookies."""
    try:
        claims = await verify_passwordless(body.email, body.code)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    email = claims.get("email") or body.email
    auth0_sub = claims.get("sub", "")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Your email is not authorized. Contact the administrator.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    if not user.auth0_id and auth0_sub:
        user.auth0_id = auth0_sub
        db.add(user)
        await db.flush()

    token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
    )

    cookie_opts: dict = dict(samesite="lax", max_age=36000, path="/")

    response.set_cookie(key="access_token", value=token, httponly=True, **cookie_opts)

    js_payload = json.dumps({
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "username": user.display_name or user.email.split("@")[0],
    })
    response.set_cookie(key="access_token_js", value=js_payload, httponly=False, **cookie_opts)

    return {
        "success": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "username": user.display_name or user.email.split("@")[0],
        },
    }


@router.get("/get-auth-role")
async def get_auth_role(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's info.  Used by UserContext on mount."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "username": current_user.display_name or current_user.email.split("@")[0],
    }


@router.post("/logout")
async def logout(response: Response):
    """Clear auth cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("access_token_js", path="/")
    return {"success": True}
