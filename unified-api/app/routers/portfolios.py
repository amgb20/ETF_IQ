from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Portfolio, Position, ETF, Price, PortfolioSnapshot, ETFHolding
from app.schemas.portfolio import (
    PortfolioCreate,
    PortfolioResponse,
    PositionBrief,
    SnapshotResponse,
    OverlapResponse,
)
from app.schemas.position import PositionCreate, PositionResponse
from app.auth.dependencies import RequireAuth

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.get("", response_model=list[PortfolioResponse])
async def list_portfolios(user: RequireAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user.id)
    )
    return [
        PortfolioResponse(id=p.id, name=p.name, description=p.description, created_at=p.created_at)
        for p in result.scalars().all()
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
async def get_portfolio(portfolio_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.positions).selectinload(Position.etf))
        .options(selectinload(Portfolio.positions).selectinload(Position.theme))
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    position_briefs: list[PositionBrief] = []
    total_value = 0.0
    total_invested = 0.0

    for pos in portfolio.positions:
        if not pos.is_active:
            continue
        latest_price = await _latest_price(db, pos.etf_id)
        current_value = float(pos.shares) * latest_price if latest_price else None
        pnl = (current_value - float(pos.invested_amount)) if current_value else None
        pnl_pct = (pnl / float(pos.invested_amount) * 100) if pnl and float(pos.invested_amount) else None

        if current_value:
            total_value += current_value
        total_invested += float(pos.invested_amount)

        position_briefs.append(
            PositionBrief(
                id=pos.id,
                etf_isin=pos.etf.isin,
                etf_name=pos.etf.name,
                ticker_yf=pos.etf.ticker_yf,
                shares=float(pos.shares),
                entry_price=float(pos.entry_price),
                entry_date=pos.entry_date,
                invested_amount=float(pos.invested_amount),
                current_price=latest_price,
                current_value=round(current_value, 2) if current_value else None,
                pnl=round(pnl, 2) if pnl else None,
                pnl_pct=round(pnl_pct, 2) if pnl_pct else None,
                target_allocation=float(pos.target_allocation) if pos.target_allocation else None,
                theme_name=pos.theme.name if pos.theme else pos.layer_label,
            )
        )

    total_pnl = total_value - total_invested if total_value else None
    total_pnl_pct = (total_pnl / total_invested * 100) if total_pnl and total_invested else None

    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        description=portfolio.description,
        created_at=portfolio.created_at,
        positions=position_briefs,
        total_value=round(total_value, 2) if total_value else None,
        total_pnl=round(total_pnl, 2) if total_pnl else None,
        total_pnl_pct=round(total_pnl_pct, 2) if total_pnl_pct else None,
    )


@router.post("/{portfolio_id}/positions", response_model=PositionResponse, status_code=201)
async def add_position(portfolio_id: uuid.UUID, body: PositionCreate, db: AsyncSession = Depends(get_db)):
    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    etf = await db.get(ETF, body.etf_id)
    if not etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    position = Position(
        portfolio_id=portfolio_id,
        etf_id=body.etf_id,
        theme_id=body.theme_id,
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


@router.get("/{portfolio_id}/snapshot", response_model=SnapshotResponse)
async def get_snapshot(portfolio_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
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
async def get_overlap(portfolio_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Compute holding overlap matrix across all positions in the portfolio."""
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
