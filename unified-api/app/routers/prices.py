from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Price
from app.schemas.price import PriceRow, PriceSeriesResponse

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("", response_model=PriceSeriesResponse)
async def get_prices(
    etf_id: uuid.UUID,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    conditions = [Price.etf_id == etf_id]
    if date_from:
        conditions.append(Price.date >= date_from)
    if date_to:
        conditions.append(Price.date <= date_to)

    result = await db.execute(select(Price).where(and_(*conditions)).order_by(Price.date))
    rows = result.scalars().all()
    return PriceSeriesResponse(
        etf_id=etf_id,
        prices=[PriceRow.model_validate(r) for r in rows],
    )
