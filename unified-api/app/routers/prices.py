from __future__ import annotations

import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Price, ETF, Portfolio, Position
from app.schemas.price import PriceRow, PriceSeriesResponse
from app.auth.dependencies import RequireAuth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("", response_model=PriceSeriesResponse)
async def get_prices(
    etf_id: uuid.UUID,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    logger.info("GET /prices  etf_id=%s  from=%s  to=%s", etf_id, date_from, date_to)

    conditions = [Price.etf_id == etf_id]
    if date_from:
        conditions.append(Price.date >= date_from)
    if date_to:
        conditions.append(Price.date <= date_to)

    result = await db.execute(select(Price).where(and_(*conditions)).order_by(Price.date))
    rows = result.scalars().all()
    logger.info("GET /prices  etf_id=%s  returning %d rows", etf_id, len(rows))
    return PriceSeriesResponse(
        etf_id=etf_id,
        prices=[PriceRow.model_validate(r) for r in rows],
    )


@router.post("/sync")
async def sync_prices(
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a yfinance price sync for all ETFs in the user's portfolios."""
    from data_connectors.registry import get_registry

    stmt = (
        select(ETF.ticker_yf)
        .join(Position, Position.etf_id == ETF.id)
        .join(Portfolio, Portfolio.id == Position.portfolio_id)
        .where(Portfolio.user_id == user.id, Position.is_active == True, ETF.ticker_yf.isnot(None))
        .distinct()
    )
    result = await db.execute(stmt)
    tickers = [row[0] for row in result.all()]

    if not tickers:
        logger.warning("POST /prices/sync  user=%s  no tickers found in portfolios", user.id)
        raise HTTPException(status_code=404, detail="No ETFs with yfinance tickers found in your portfolios")

    logger.info("POST /prices/sync  user=%s  tickers=%s", user.id, tickers)

    connector = get_registry().get("yfinance")
    if not connector:
        raise HTTPException(status_code=500, detail="yfinance connector not available")

    await connector.ingest(db, tickers=tickers, period="max")

    count_result = await db.execute(
        select(Price.etf_id, Price.date)
        .join(ETF, ETF.id == Price.etf_id)
        .where(ETF.ticker_yf.in_(tickers))
    )
    total_rows = len(count_result.all())

    logger.info("POST /prices/sync  user=%s  sync complete  total_price_rows=%d", user.id, total_rows)
    return {"status": "ok", "tickers_synced": tickers, "total_price_rows": total_rows}
