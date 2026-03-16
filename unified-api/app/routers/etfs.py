import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ETF, Price
from app.schemas.etf import ETFDetailResponse, ETFDiscoverItem, ETFListItem, QuoteResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/etfs", tags=["etfs"])


@router.get("", response_model=list[ETFListItem])
async def list_etfs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ETF).order_by(ETF.name))
    etfs = result.scalars().all()
    logger.info("GET /etfs  returning %d etfs", len(etfs))
    return [ETFListItem.model_validate(e) for e in etfs]


@router.get("/search", response_model=list[ETFListItem])
async def search_etfs(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
):
    """Search ETFs by name or ISIN using pg_trgm-backed ILIKE."""
    logger.info("GET /etfs/search  q=%s", q)
    stmt = (
        select(ETF)
        .where(or_(
            ETF.name.ilike(f"%{q}%"),
            ETF.isin.ilike(f"%{q}%"),
            ETF.ticker_yf.ilike(f"%{q}%"),
        ))
        .order_by(ETF.name)
        .limit(20)
    )
    result = await db.execute(stmt)
    etfs = result.scalars().all()
    logger.info("GET /etfs/search  q=%s  returning %d results", q, len(etfs))
    return [ETFListItem.model_validate(e) for e in etfs]


@router.get("/discover", response_model=list[ETFListItem])
async def discover_etfs(
    q: str = Query("", min_length=0),
    asset_class: str | None = None,
    country: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Search the justETF universe and auto-ingest results into the local DB."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from data_connectors.registry import get_registry

    connector = get_registry().get("justetf_discovery")
    if not connector:
        logger.warning("justetf_discovery connector not registered")
        return []

    try:
        raw = await connector.fetch(query=q, asset_class=asset_class, country=country)
        normalized = await connector.normalize(raw)
    except Exception:
        logger.exception("ETF discover fetch/normalize failed for q=%r", q)
        return []

    if not normalized:
        return []

    try:
        for item in normalized:
            stmt = pg_insert(ETF.__table__).values(
                isin=item["isin"],
                name=item["name"],
                ticker_yf=item.get("ticker_yf"),
                currency=item.get("currency"),
                exchange=item.get("exchange"),
                ter=item.get("ter"),
                aum_eur=item.get("aum_eur"),
                domicile=item.get("domicile"),
            ).on_conflict_do_update(
                index_elements=["isin"],
                set_={"name": item["name"]},
            )
            await db.execute(stmt)
        await db.commit()
    except Exception:
        logger.exception("ETF discover ingest failed")
        await db.rollback()

    isins = [item["isin"] for item in normalized]
    result = await db.execute(
        select(ETF).where(ETF.isin.in_(isins)).order_by(ETF.name)
    )
    etfs = result.scalars().all()
    return [ETFListItem.model_validate(e) for e in etfs]


@router.get("/{isin}/quote", response_model=QuoteResponse)
async def get_etf_quote(isin: str, db: AsyncSession = Depends(get_db)):
    """Latest quote summary derived from stored price data."""
    etf_result = await db.execute(select(ETF).where(ETF.isin == isin))
    etf = etf_result.scalar_one_or_none()
    if not etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    recent = (
        await db.execute(
            select(Price)
            .where(Price.etf_id == etf.id)
            .order_by(Price.date.desc())
            .limit(2)
        )
    ).scalars().all()

    if not recent:
        return QuoteResponse(isin=isin, last_close=None, last_date=None,
                             previous_close=None, day_change=None,
                             day_change_pct=None, week_52_high=None,
                             week_52_low=None)

    last = recent[0]
    prev = recent[1] if len(recent) > 1 else None
    day_change = round(float(last.close) - float(prev.close), 4) if prev else None
    day_change_pct = round(day_change / float(prev.close) * 100, 2) if prev and float(prev.close) else None

    year_ago = date.today() - timedelta(days=365)
    hi_lo = await db.execute(
        select(func.max(Price.high), func.min(Price.low))
        .where(and_(Price.etf_id == etf.id, Price.date >= year_ago))
    )
    row = hi_lo.one_or_none()
    w52_high = round(float(row[0]), 4) if row and row[0] else None
    w52_low = round(float(row[1]), 4) if row and row[1] else None

    return QuoteResponse(
        isin=isin,
        last_close=round(float(last.close), 4),
        last_date=last.date,
        previous_close=round(float(prev.close), 4) if prev else None,
        day_change=day_change,
        day_change_pct=day_change_pct,
        week_52_high=w52_high,
        week_52_low=w52_low,
    )


@router.get("/{isin}", response_model=ETFDetailResponse)
async def get_etf_detail(isin: str, db: AsyncSession = Depends(get_db)):
    logger.info("GET /etfs/%s", isin)
    result = await db.execute(
        select(ETF)
        .options(selectinload(ETF.holdings), selectinload(ETF.allocations))
        .where(ETF.isin == isin)
    )
    etf = result.scalar_one_or_none()
    if not etf:
        logger.warning("GET /etfs/%s  NOT FOUND", isin)
        raise HTTPException(status_code=404, detail="ETF not found")
    logger.info("GET /etfs/%s  found: name=%s  ticker_yf=%s", isin, etf.name, etf.ticker_yf)
    return ETFDetailResponse.model_validate(etf)
