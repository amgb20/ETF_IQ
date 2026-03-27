"""Auth0 passwordless OTP router.

Endpoints
---------
POST /auth/login/passwordless/start   — send OTP to email
POST /auth/login/passwordless/verify  — verify OTP, issue JWT, set cookies
POST /auth/refresh                    — slide token expiry without re-OTP
GET  /auth/get-auth-role              — return current user info (requires auth)
POST /auth/logout                     — revoke token, clear auth cookies
"""

import json
import logging
import math
import time as _time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import jwt as jose_jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

from .audit import AuthEvent, log_auth_event
from .auth0 import start_passwordless, verify_passwordless
from .dependencies import get_current_user
from .jwt import create_access_token, decode_token
from .otp_limiter import check_otp_rate_limit, check_start_rate_limit, reset_otp_rate_limit
from .token_blocklist import block_token, is_token_blocked

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class StartRequest(BaseModel):
    email: EmailStr


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class SignupRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None
    base_currency: str = "EUR"
    investment_goal: str | None = None
    risk_tolerance: str | None = None


def _cookie_opts(settings) -> dict:
    """Shared cookie options — single source of truth.

    max_age is derived from ACCESS_TOKEN_EXPIRE_MINUTES so the cookie
    and the JWT always expire at the same time.
    """
    is_prod = not getattr(settings, "DEBUG", False)
    return dict(
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        secure=is_prod,
    )


def _set_auth_cookies(response: Response, user: User, token: str, settings) -> None:
    """Write the HttpOnly access_token and the JS-readable access_token_js cookie."""
    opts = _cookie_opts(settings)
    response.set_cookie(key="access_token", value=token, httponly=True, **opts)
    # Intentionally JS-readable: the frontend UserContext reads role + username
    # from this cookie for conditional rendering (e.g. admin sidebar).  The
    # actual auth check always uses the HttpOnly access_token above.
    js_payload = json.dumps(
        {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "username": user.display_name or user.email.split("@")[0],
        }
    )
    response.set_cookie(key="access_token_js", value=js_payload, httponly=False, **opts)


def _client_ip(request: Request) -> str | None:
    """Return the real client IP, honouring X-Forwarded-For only behind a trusted proxy.

    X-Forwarded-For is trivially spoofable by clients.  We only trust it
    when TRUSTED_PROXY=true, meaning the app sits behind a known reverse proxy
    (e.g. Nginx, Vercel, AWS ALB) that overwrites the header.
    """
    settings = get_settings()
    if settings.TRUSTED_PROXY:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/signup")
async def signup(
    body: SignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user: create in Auth0 + local DB, then send OTP.

    Flow:
      1. Check email not already in local DB.
      2. Create the user in Auth0 via Management API (handles "already exists").
      3. Insert a row into the local ``users`` table.
      4. Send a passwordless OTP so the user can verify immediately.
    """
    email = body.email.lower().strip()
    ip = _client_ip(request)

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in.",
        )

    # ── Auth0 user creation ─────────────────────────────────────────
    from .auth0_management import create_auth0_user

    auth0_id = None
    try:
        auth0_user = await create_auth0_user(email, name=body.display_name)
        if auth0_user:
            auth0_id = auth0_user.get("user_id")
    except RuntimeError as exc:
        logger.error("Auth0 user creation failed for %s: %s", email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create account. Please try again.",
        ) from exc

    # ── Local DB user creation ──────────────────────────────────────
    user = User(
        email=email,
        display_name=body.display_name,
        base_currency=body.base_currency,
        investment_goal=body.investment_goal,
        risk_tolerance=body.risk_tolerance,
        role="user",
        is_active=True,
        auth0_id=auth0_id,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in.",
        )

    # ── Send OTP ────────────────────────────────────────────────────
    try:
        await start_passwordless(email)
    except ValueError as exc:
        logger.warning("Failed to send OTP after signup for %s: %s", email, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account created but failed to send verification code. Please try signing in.",
        ) from exc

    await log_auth_event(AuthEvent.LOGIN_SUCCESS, email=email, ip=ip, detail="signup")
    logger.info("New user registered: %s (display_name=%s)", email, body.display_name)
    return {"success": True}


@router.post("/login/passwordless/start")
async def passwordless_start(body: StartRequest, request: Request):
    """Send a 6-digit OTP to the provided email address via Auth0."""
    await check_start_rate_limit(body.email)
    try:
        await start_passwordless(body.email)
        return {"success": True}
    except ValueError as exc:
        logger.warning("Passwordless start error for %s: %s", body.email, exc)
        raise HTTPException(status_code=400, detail="Failed to send verification code") from exc
    except Exception as exc:
        logger.error("Passwordless start unexpected error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to send verification code") from exc


@router.post("/login/passwordless/verify")
async def passwordless_verify(
    body: VerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP, look up pre-authorized user, issue internal JWT cookies."""
    ip = _client_ip(request)

    await check_otp_rate_limit(body.email)

    try:
        claims = await verify_passwordless(body.email, body.code)
    except ValueError as exc:
        logger.warning("OTP verify error for %s: %s", body.email, exc)
        await log_auth_event(
            AuthEvent.LOGIN_FAILURE,
            email=body.email,
            ip=ip,
            detail="invalid or expired OTP",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP code",
        ) from exc

    # Require email from the verified Auth0 token — never trust the request body.
    email = claims.get("email")
    if not email:
        logger.error("Auth0 id_token missing email claim for request email=%s", body.email)
        await log_auth_event(AuthEvent.LOGIN_FAILURE, email=body.email, ip=ip, detail="missing email claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP code",
        )

    auth0_sub = claims.get("sub", "")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        await log_auth_event(
            AuthEvent.LOGIN_FAILURE,
            email=email,
            ip=ip,
            detail="email not in allowlist",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Your email is not authorized. Contact the administrator.",
        )

    if not user.is_active:
        await log_auth_event(
            AuthEvent.ACCOUNT_DISABLED,
            email=user.email,
            user_id=str(user.id),
            ip=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    if not user.auth0_id and auth0_sub:
        user.auth0_id = auth0_sub
        db.add(user)
        await db.commit()

    token = create_access_token(user_id=str(user.id), email=user.email, role=user.role)
    settings = get_settings()
    _set_auth_cookies(response, user, token, settings)

    await reset_otp_rate_limit(body.email)
    await log_auth_event(
        AuthEvent.LOGIN_SUCCESS,
        email=user.email,
        user_id=str(user.id),
        ip=ip,
    )

    return {
        "success": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "username": user.display_name or user.email.split("@")[0],
        },
    }


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Issue a fresh JWT pair without requiring a new OTP.

    The existing HttpOnly access_token cookie is validated and then revoked.
    A new token is issued and written back to the cookies.
    """
    ip = _client_ip(request)
    raw_token = request.cookies.get("access_token")
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(raw_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = payload.get("sub")
    old_jti = payload.get("jti")
    old_exp = payload.get("exp", 0)

    # Reject revoked tokens — mirrors the check in get_current_user.
    if old_jti and await is_token_blocked(old_jti):
        await log_auth_event(
            AuthEvent.TOKEN_REVOKED,
            user_id=user_id,
            ip=ip,
            detail="blocked token presented to /refresh",
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    # Revoke the old token before issuing a new one.
    if old_jti:
        remaining_ttl = max(1, math.ceil(old_exp - _time.time()))
        await block_token(old_jti, remaining_ttl)

    new_token = create_access_token(user_id=str(user.id), email=user.email, role=user.role)
    settings = get_settings()
    _set_auth_cookies(response, user, new_token, settings)

    await log_auth_event(
        AuthEvent.TOKEN_REFRESH,
        email=user.email,
        user_id=str(user.id),
        ip=ip,
    )

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
async def logout(request: Request, response: Response):
    """Revoke the current token and clear auth cookies."""
    raw_token = request.cookies.get("access_token")

    if raw_token:
        try:
            # Parse unverified claims — we only need jti + exp + email for revoking and logging.
            claims = jose_jwt.get_unverified_claims(raw_token)
            jti = claims.get("jti")
            exp = claims.get("exp", 0)
            email = claims.get("email")
            user_id = claims.get("sub")

            if jti:
                remaining_ttl = max(1, math.ceil(exp - _time.time()))
                await block_token(jti, remaining_ttl)

            await log_auth_event(
                AuthEvent.LOGOUT,
                email=email,
                user_id=user_id,
                ip=_client_ip(request),
            )
        except Exception as exc:
            logger.warning("Logout: could not parse token for revocation: %s", exc)

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("access_token_js", path="/")
    return {"success": True}
