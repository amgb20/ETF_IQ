from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.alert import Alert, AlertEvent
from app.models.notification import Notification
from app.schemas.alert import AlertCreate, AlertResponse, AlertUpdate
from app.auth.dependencies import RequireAuth, verify_portfolio_owner

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    portfolio_id: uuid.UUID = Query(...),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    result = await db.execute(
        select(Alert)
        .options(selectinload(Alert.events))
        .where(Alert.portfolio_id == portfolio_id)
        .order_by(desc(Alert.created_at))
    )
    alerts = result.scalars().all()
    return [AlertResponse.model_validate(a) for a in alerts]


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    body: AlertCreate,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(body.portfolio_id, user, db)

    alert = Alert(
        portfolio_id=body.portfolio_id,
        etf_id=body.etf_id,
        type=body.type,
        threshold=body.threshold,
    )
    db.add(alert)
    await db.flush()
    await db.refresh(alert, attribute_names=["events"])

    db.add(Notification(
        user_id=user.id,
        type="alert_configured",
        title="Alert configured",
        message=f"{body.type.replace('_', ' ').title()} alert set at {body.threshold}",
        ref_id=alert.id,
    ))

    return AlertResponse.model_validate(alert)


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: uuid.UUID,
    body: AlertUpdate,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).options(selectinload(Alert.events)).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await verify_portfolio_owner(alert.portfolio_id, user, db)

    if body.threshold is not None:
        alert.threshold = body.threshold
    if body.is_active is not None:
        alert.is_active = body.is_active

    await db.flush()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await verify_portfolio_owner(alert.portfolio_id, user, db)

    alert.is_active = False
    await db.flush()
