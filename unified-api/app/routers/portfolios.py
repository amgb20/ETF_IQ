from __future__ import annotations

import logging
import re
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc, func as sa_func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Portfolio, Position, ETF, Price, PortfolioSnapshot, ETFHolding
from app.models.portfolio import PortfolioTheme
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioResponse,
    PositionBrief,
    ThemeBrief,
    ThemeCreate,
    ThemeUpdate,
    PositionThemeUpdate,
    SnapshotResponse,
    OverlapResponse,
)
from app.schemas.position import PositionCreate, PositionResponse
from app.auth.dependencies import RequireAuth, verify_portfolio_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


@router.get("", response_model=list[PortfolioResponse])
async def list_portfolios(user: RequireAuth, db: AsyncSession = Depends(get_db)):
    logger.info("GET /portfolios  user=%s", user.id)
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id)
    )
    portfolios = result.scalars().all()
    logger.info("GET /portfolios  user=%s  returning %d portfolios", user.id, len(portfolios))
    return [
        PortfolioResponse(id=p.id, name=p.name, description=p.description, created_at=p.created_at)
        for p in portfolios
    ]


@router.post("", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(body: PortfolioCreate, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    portfolio = Portfolio(name=body.name, description=body.description, user_id=user.id)
    db.add(portfolio)
    await db.flush()
    await db.refresh(portfolio)
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
    )


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: uuid.UUID, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    logger.info("GET /portfolios/%s  user=%s", portfolio_id, user.id)
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.positions).selectinload(Position.etf))
        .options(selectinload(Portfolio.positions).selectinload(Position.theme))
        .options(selectinload(Portfolio.themes).selectinload(PortfolioTheme.positions))
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if portfolio.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    theme_briefs = [
        ThemeBrief(
            id=t.id,
            name=t.name,
            color=t.color,
            research_agent=t.research_agent,
            sort_order=t.sort_order,
            position_count=sum(1 for p in t.positions if p.is_active),
        )
        for t in sorted(portfolio.themes, key=lambda t: t.sort_order)
    ]

    position_briefs: list[PositionBrief] = []
    total_value = 0.0
    total_invested = 0.0

    for pos in portfolio.positions:
        if not pos.is_active:
            continue
        latest_price = await _latest_price(db, pos.etf_id)
        logger.info(
            "  position etf_id=%s  isin=%s  ticker_yf=%s  latest_price=%s  entry_price=%s",
            pos.etf_id, pos.etf.isin, pos.etf.ticker_yf, latest_price, pos.entry_price,
        )
        effective_price = latest_price if latest_price is not None else float(pos.entry_price)
        current_value = float(pos.shares) * effective_price
        invested = float(pos.invested_amount)
        pnl = current_value - invested if invested else None
        pnl_pct = (pnl / invested * 100) if pnl and invested else None

        total_value += current_value
        total_invested += invested

        position_briefs.append(
            PositionBrief(
                id=pos.id,
                etf_id=pos.etf_id,
                etf_isin=pos.etf.isin,
                etf_name=pos.etf.name,
                ticker_yf=pos.etf.ticker_yf,
                shares=float(pos.shares),
                entry_price=float(pos.entry_price),
                entry_date=pos.entry_date,
                invested_amount=invested,
                current_price=effective_price,
                current_value=round(current_value, 2),
                pnl=round(pnl, 2) if pnl is not None else None,
                pnl_pct=round(pnl_pct, 2) if pnl_pct is not None else None,
                target_allocation=float(pos.target_allocation) if pos.target_allocation else None,
                theme_name=pos.theme.name if pos.theme else pos.layer_label,
                theme_color=pos.theme.color if pos.theme else None,
            )
        )

    total_pnl = total_value - total_invested if total_invested else None
    total_pnl_pct = (total_pnl / total_invested * 100) if total_pnl and total_invested else None

    logger.info(
        "GET /portfolios/%s  positions=%d  total_value=%.2f  total_invested=%.2f",
        portfolio_id, len(position_briefs), total_value, total_invested,
    )
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
        positions=position_briefs,
        themes=theme_briefs,
        total_value=round(total_value, 2) if total_value else None,
        total_pnl=round(total_pnl, 2) if total_pnl is not None else None,
        total_pnl_pct=round(total_pnl_pct, 2) if total_pnl_pct is not None else None,
    )


@router.post("/{portfolio_id}/positions", response_model=PositionResponse, status_code=201)
async def add_position(portfolio_id: uuid.UUID, body: PositionCreate, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload as _sel
    from app.agents.onboarding.theme_classifier import classify_single_etf

    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if portfolio.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    etf_result = await db.execute(
        select(ETF)
        .options(_sel(ETF.holdings), _sel(ETF.allocations))
        .where(ETF.id == body.etf_id)
    )
    etf = etf_result.scalar_one_or_none()
    if not etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    theme_id = body.theme_id

    # Auto-classify when no theme is explicitly provided
    if theme_id is None and not body.layer_label:
        themes_result = await db.execute(
            select(PortfolioTheme).where(PortfolioTheme.portfolio_id == portfolio_id)
        )
        existing = [{"id": t.id, "name": t.name} for t in themes_result.scalars().all()]

        try:
            classification = await classify_single_etf(etf, existing)
            if classification["action"] == "assign":
                theme_id = classification["theme_id"]
            else:
                max_order = await db.execute(
                    select(sa_func.coalesce(sa_func.max(PortfolioTheme.sort_order), -1))
                    .where(PortfolioTheme.portfolio_id == portfolio_id)
                )
                new_theme = PortfolioTheme(
                    portfolio_id=portfolio_id,
                    name=classification["name"],
                    color=classification.get("color", "#71717a"),
                    sort_order=(max_order.scalar() or 0) + 1,
                    research_agent=f"{_slugify(classification['name'])}_analyst",
                )
                db.add(new_theme)
                await db.flush()
                theme_id = new_theme.id
        except Exception:
            logger.warning("Auto-classify failed for ETF %s, proceeding without theme", body.etf_id, exc_info=True)

    position = Position(
        portfolio_id=portfolio_id,
        etf_id=body.etf_id,
        theme_id=theme_id,
        layer_label=body.layer_label,
        target_allocation=body.target_allocation,
        entry_date=body.entry_date,
        entry_price=body.entry_price,
        shares=body.shares,
        invested_amount=body.invested_amount,
    )
    db.add(position)
    await db.flush()
    await db.refresh(position)
    return PositionResponse.model_validate(position)


# ── Theme CRUD ────────────────────────────────────────────────────────


@router.get("/{portfolio_id}/themes", response_model=list[ThemeBrief])
async def list_themes(portfolio_id: uuid.UUID, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    await verify_portfolio_owner(portfolio_id, user, db)
    result = await db.execute(
        select(PortfolioTheme)
        .options(selectinload(PortfolioTheme.positions))
        .where(PortfolioTheme.portfolio_id == portfolio_id)
        .order_by(PortfolioTheme.sort_order)
    )
    themes = result.scalars().all()
    return [
        ThemeBrief(
            id=t.id,
            name=t.name,
            color=t.color,
            research_agent=t.research_agent,
            sort_order=t.sort_order,
            position_count=sum(1 for p in t.positions if p.is_active),
        )
        for t in themes
    ]


@router.post("/{portfolio_id}/themes", response_model=ThemeBrief, status_code=201)
async def create_theme(portfolio_id: uuid.UUID, body: ThemeCreate, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    await verify_portfolio_owner(portfolio_id, user, db)

    max_order = await db.execute(
        select(sa_func.coalesce(sa_func.max(PortfolioTheme.sort_order), -1))
        .where(PortfolioTheme.portfolio_id == portfolio_id)
    )
    next_order = (max_order.scalar() or 0) + 1

    agent_name = f"{_slugify(body.name)}_analyst"

    theme = PortfolioTheme(
        portfolio_id=portfolio_id,
        name=body.name,
        color=body.color,
        sort_order=next_order,
        research_agent=agent_name,
    )
    db.add(theme)
    await db.flush()
    await db.refresh(theme)

    return ThemeBrief(
        id=theme.id,
        name=theme.name,
        color=theme.color,
        research_agent=theme.research_agent,
        sort_order=theme.sort_order,
        position_count=0,
    )


@router.put("/{portfolio_id}/themes/{theme_id}", response_model=ThemeBrief)
async def update_theme(
    portfolio_id: uuid.UUID, theme_id: uuid.UUID, body: ThemeUpdate,
    user: RequireAuth, db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)
    theme = await db.get(PortfolioTheme, theme_id)
    if not theme or theme.portfolio_id != portfolio_id:
        raise HTTPException(status_code=404, detail="Theme not found")

    if body.name is not None:
        theme.name = body.name
        theme.research_agent = f"{_slugify(body.name)}_analyst"
    if body.color is not None:
        theme.color = body.color

    await db.flush()
    await db.refresh(theme)

    pos_count = await db.execute(
        select(sa_func.count(Position.id))
        .where(Position.theme_id == theme_id, Position.is_active == True)  # noqa: E712
    )
    return ThemeBrief(
        id=theme.id,
        name=theme.name,
        color=theme.color,
        research_agent=theme.research_agent,
        sort_order=theme.sort_order,
        position_count=pos_count.scalar() or 0,
    )


@router.delete("/{portfolio_id}/themes/{theme_id}", status_code=204)
async def delete_theme(
    portfolio_id: uuid.UUID, theme_id: uuid.UUID,
    user: RequireAuth, db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)
    theme = await db.get(PortfolioTheme, theme_id)
    if not theme or theme.portfolio_id != portfolio_id:
        raise HTTPException(status_code=404, detail="Theme not found")

    await db.execute(
        update(Position)
        .where(Position.theme_id == theme_id)
        .values(theme_id=None, layer_label=theme.name)
    )
    await db.delete(theme)
    await db.flush()


@router.put("/{portfolio_id}/positions/{position_id}/theme")
async def reassign_position_theme(
    portfolio_id: uuid.UUID, position_id: uuid.UUID,
    body: PositionThemeUpdate, user: RequireAuth, db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)
    position = await db.get(Position, position_id)
    if not position or position.portfolio_id != portfolio_id:
        raise HTTPException(status_code=404, detail="Position not found")

    if body.theme_id is not None:
        theme = await db.get(PortfolioTheme, body.theme_id)
        if not theme or theme.portfolio_id != portfolio_id:
            raise HTTPException(status_code=404, detail="Theme not found")

    position.theme_id = body.theme_id
    if body.theme_id is not None:
        position.layer_label = None
    await db.flush()
    return {"status": "ok"}


@router.get("/{portfolio_id}/snapshot", response_model=SnapshotResponse)
async def get_snapshot(portfolio_id: uuid.UUID, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    await verify_portfolio_owner(portfolio_id, user, db)

    result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.portfolio_id == portfolio_id)
        .order_by(desc(PortfolioSnapshot.date))
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No snapshots found for this portfolio")
    return SnapshotResponse.model_validate(snapshot)


@router.get("/{portfolio_id}/overlap", response_model=OverlapResponse)
async def get_overlap(portfolio_id: uuid.UUID, user: RequireAuth, db: AsyncSession = Depends(get_db)):
    """Compute holding overlap matrix across all positions in the portfolio."""
    await verify_portfolio_owner(portfolio_id, user, db)

    positions = (
        await db.execute(
            select(Position)
            .options(selectinload(Position.etf).selectinload(ETF.holdings))
            .where(Position.portfolio_id == portfolio_id, Position.is_active == True)  # noqa: E712
        )
    ).scalars().all()

    if not positions:
        raise HTTPException(status_code=404, detail="No active positions found")

    etf_holdings_map: dict[str, set[str]] = defaultdict(set)
    for pos in positions:
        for h in pos.etf.holdings:
            if h.holding_isin:
                etf_holdings_map[pos.etf.isin].add(h.holding_isin)

    isins = sorted(etf_holdings_map.keys())
    overlap: dict[str, dict[str, list[str]]] = {}
    for i, a in enumerate(isins):
        overlap[a] = {}
        for b in isins[i + 1 :]:
            shared = etf_holdings_map[a] & etf_holdings_map[b]
            if shared:
                overlap[a][b] = sorted(shared)

    return OverlapResponse(overlap=overlap)


async def _latest_price(db: AsyncSession, etf_id: uuid.UUID) -> float | None:
    result = await db.execute(
        select(Price.close).where(Price.etf_id == etf_id).order_by(desc(Price.date)).limit(1)
    )
    row = result.scalar_one_or_none()
    return float(row) if row is not None else None
