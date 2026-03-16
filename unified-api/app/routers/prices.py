from __future__ import annotations

import logging
import time as _time
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Price, ETF, Portfolio, Position
from app.schemas.price import (
    PriceRow,
    PriceSeriesResponse,
    IntradayRow,
    IntradaySeriesResponse,
    PriceStatusResponse,
)
from app.auth.dependencies import RequireAuth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prices", tags=["prices"])

# Simple TTL cache for intraday data (60s) to avoid hammering yfinance
_intraday_cache: dict[str, tuple[float, object]] = {}
_CACHE_TTL = 60  # seconds

# Valid interval/period combinations for yfinance
_MAX_PERIOD_FOR_INTERVAL = {
    "1m": "7d",
    "2m": "60d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "1h": "730d",
    "90m": "60d",
}


def _last_trading_day() -> date:
    """Return the most recent trading day (skip weekends)."""
    today = date.today()
    wd = today.weekday()
    if wd == 5:  # Saturday
        return today - timedelta(days=1)
    if wd == 6:  # Sunday
        return today - timedelta(days=2)
    return today


@router.get("/status", response_model=PriceStatusResponse)
async def get_price_status(
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Check the freshness of stored price data for the user's portfolios."""
    stmt = (
        select(func.max(Price.date))
        .join(ETF, ETF.id == Price.etf_id)
        .join(Position, Position.etf_id == ETF.id)
        .join(Portfolio, Portfolio.id == Position.portfolio_id)
        .where(Portfolio.user_id == user.id, Position.is_active == True)
    )
    result = await db.execute(stmt)
    latest = result.scalar_one_or_none()

    last_td = _last_trading_day()
    needs_sync = latest is None or latest < last_td

    return PriceStatusResponse(
        latest_date=latest.isoformat() if latest else None,
        needs_sync=needs_sync,
    )


@router.get("/intraday", response_model=IntradaySeriesResponse)
async def get_intraday(
    ticker: str,
    period: str = "1d",
    interval: str = "5m",
):
    """Fetch intraday OHLCV data on-demand from yfinance (not stored in DB)."""
    from data_connectors.registry import get_registry

    # Validate interval
    valid_intervals = {"1m", "2m", "5m", "15m", "30m", "1h", "90m", "1d", "5d", "1wk", "1mo", "3mo"}
    if interval not in valid_intervals:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'. Valid: {sorted(valid_intervals)}")

    # Check cache (simple TTL dict)
    cache_key = f"{ticker}|{period}|{interval}"
    entry = _intraday_cache.get(cache_key)
    if entry is not None:
        ts, cached_response = entry
        if _time.time() - ts < _CACHE_TTL:
            logger.info("GET /prices/intraday  cache hit: %s", cache_key)
            return cached_response
        else:
            del _intraday_cache[cache_key]

    connector = get_registry().get("yfinance")
    if not connector:
        raise HTTPException(status_code=500, detail="yfinance connector not available")

    try:
        rows = await connector.fetch_intraday(tickers=[ticker], period=period, interval=interval)
    except Exception as exc:
        logger.exception("Intraday fetch failed for %s: %s", ticker, exc)
        raise HTTPException(status_code=502, detail=f"yfinance fetch failed: {exc}")

    # Filter to requested ticker only (connector may include EURUSD=X)
    ticker_rows = [r for r in rows if r["ticker"] == ticker]

    response = IntradaySeriesResponse(
        ticker=ticker,
        interval=interval,
        prices=[
            IntradayRow(
                timestamp=r["timestamp"],
                open=r["open"],
                high=r["high"],
                low=r["low"],
                close=r["close"],
                volume=r["volume"],
            )
            for r in ticker_rows
            if r["close"] is not None
        ],
    )

    _intraday_cache[cache_key] = (_time.time(), response)
    return response


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
    period: str = Query("5d", description="yfinance period (e.g. 5d, 1mo, max)"),
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

    logger.info("POST /prices/sync  user=%s  tickers=%s  period=%s", user.id, tickers, period)

    connector = get_registry().get("yfinance")
    if not connector:
        raise HTTPException(status_code=500, detail="yfinance connector not available")

    await connector.ingest(db, tickers=tickers, period=period)

    count_result = await db.execute(
        select(Price.etf_id, Price.date)
        .join(ETF, ETF.id == Price.etf_id)
        .where(ETF.ticker_yf.in_(tickers))
    )
    total_rows = len(count_result.all())

    logger.info("POST /prices/sync  user=%s  sync complete  total_price_rows=%d", user.id, total_rows)
    return {"status": "ok", "tickers_synced": tickers, "total_price_rows": total_rows}
