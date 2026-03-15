"""User endpoints -- profile and notification preferences."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    base_currency: str
    theme: str
    role: str
    notify_email: bool
    notify_digest: bool
    accepted_tos: bool
    is_onboarded: bool

    model_config = {"from_attributes": True}


class PreferencesUpdate(BaseModel):
    notify_email: bool | None = None
    notify_digest: bool | None = None
    accepted_tos: bool | None = None
    display_name: str | None = None
    base_currency: str | None = None
    theme: str | None = None


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
):
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        base_currency=user.base_currency,
        theme=user.theme,
        role=user.role,
        notify_email=user.notify_email,
        notify_digest=user.notify_digest,
        accepted_tos=user.accepted_tos,
        is_onboarded=user.is_onboarded,
    )


@router.put("/me/preferences", response_model=UserProfileResponse)
async def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.notify_email is not None:
        user.notify_email = body.notify_email
    if body.notify_digest is not None:
        user.notify_digest = body.notify_digest
    if body.accepted_tos is not None:
        user.accepted_tos = body.accepted_tos
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.base_currency is not None:
        user.base_currency = body.base_currency
    if body.theme is not None:
        user.theme = body.theme

    db.add(user)
    await db.flush()
    await db.refresh(user)

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        base_currency=user.base_currency,
        theme=user.theme,
        role=user.role,
        notify_email=user.notify_email,
        notify_digest=user.notify_digest,
        accepted_tos=user.accepted_tos,
        is_onboarded=user.is_onboarded,
    )
