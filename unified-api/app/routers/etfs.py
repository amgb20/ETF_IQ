from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ETF
from app.schemas.etf import ETFDetailResponse, ETFDiscoverItem, ETFListItem

router = APIRouter(prefix="/etfs", tags=["etfs"])


@router.get("", response_model=list[ETFListItem])
async def list_etfs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ETF).order_by(ETF.name))
    return [ETFListItem.model_validate(e) for e in result.scalars().all()]


@router.get("/search", response_model=list[ETFListItem])
async def search_etfs(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
):
    """Search ETFs by name or ISIN using pg_trgm-backed ILIKE."""
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
    return [ETFListItem.model_validate(e) for e in result.scalars().all()]


@router.get("/discover", response_model=list[ETFDiscoverItem])
async def discover_etfs(
    q: str = Query("", min_length=0),
    asset_class: str | None = None,
    country: str | None = None,
):
    """Search the justETF universe for ETFs to add to a portfolio."""
    from data_connectors.registry import get_registry

    connector = get_registry().get("justetf_discovery")
    if not connector:
        return []

    raw = await connector.fetch(query=q, asset_class=asset_class, country=country)
    normalized = await connector.normalize(raw)
    return [ETFDiscoverItem(**item) for item in normalized]


@router.get("/{isin}", response_model=ETFDetailResponse)
async def get_etf_detail(isin: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ETF)
        .options(selectinload(ETF.holdings), selectinload(ETF.allocations))
        .where(ETF.isin == isin)
    )
    etf = result.scalar_one_or_none()
    if not etf:
        raise HTTPException(status_code=404, detail="ETF not found")
    return ETFDetailResponse.model_validate(etf)
