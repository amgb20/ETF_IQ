from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import ChartEvent
from app.schemas.event import ChartEventResponse

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[ChartEventResponse])
async def list_events(
    portfolio_id: uuid.UUID = Query(...),
    tickers: list[str] | None = Query(None),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ChartEvent)
        .where(ChartEvent.portfolio_id == portfolio_id)
        .order_by(desc(ChartEvent.event_date))
    )

    if from_date:
        stmt = stmt.where(ChartEvent.event_date >= from_date)
    if to_date:
        stmt = stmt.where(ChartEvent.event_date <= to_date)
    if tickers:
        stmt = stmt.where(ChartEvent.tickers.overlap(tickers))

    result = await db.execute(stmt)
    events = result.scalars().all()
    return [ChartEventResponse.model_validate(e) for e in events]
