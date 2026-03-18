"""Assembles portfolio context into a structured text block for agent prompts."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Portfolio, Position, Price, ETF
from app.models.portfolio import PortfolioTheme


@dataclass
class PositionContext:
    etf_isin: str
    etf_name: str
    ticker_yf: str
    theme: str | None
    shares: float
    entry_price: float
    entry_date: date
    invested: float
    current_price: float | None
    current_value: float | None
    pnl: float | None
    pnl_pct: float | None
    target_allocation: float | None


@dataclass
class PortfolioContext:
    portfolio_id: uuid.UUID
    portfolio_name: str
    positions: list[PositionContext] = field(default_factory=list)
    total_value: float = 0.0
    total_invested: float = 0.0
    total_pnl: float | None = None
    total_pnl_pct: float | None = None

    def to_prompt_string(self) -> str:
        pnl_line = (
            f"Total P&L: €{self.total_pnl:,.2f} ({self.total_pnl_pct:+.2f}%)"
            if self.total_pnl is not None
            else "Total P&L: N/A"
        )
        lines = [
            f"PORTFOLIO: {self.portfolio_name}",
            f"Total Value: €{self.total_value:,.2f}",
            f"Total Invested: €{self.total_invested:,.2f}",
            pnl_line,
            "",
            "POSITIONS:",
        ]
        for p in self.positions:
            alloc_pct = (p.current_value / self.total_value * 100) if p.current_value and self.total_value else 0
            drift = ""
            if p.target_allocation and alloc_pct:
                d = alloc_pct - p.target_allocation
                if abs(d) > 1:
                    drift = f" (drift: {d:+.1f}%)"

            if p.current_price:
                header = (
                    f"  {p.ticker_yf} ({p.etf_name})"
                    f" | Theme: {p.theme or 'N/A'}"
                    f" | Shares: {p.shares:.4f}"
                    f" | Entry: €{p.entry_price:.2f} on {p.entry_date}"
                    f" | Current: €{p.current_price:.2f}"
                )
            else:
                header = f"  {p.ticker_yf} ({p.etf_name}) | no price data"
            lines.append(header)

            if p.current_value is not None:
                detail = f"    Value: €{p.current_value:,.2f}"
                if p.pnl is not None:
                    detail += f" | P&L: €{p.pnl:,.2f} ({p.pnl_pct:+.2f}%)"
                detail += f" | Allocation: {alloc_pct:.1f}%"
                if p.target_allocation:
                    detail += f" | Target: {p.target_allocation:.1f}%{drift}"
                lines.append(detail)
        return "\n".join(lines)


async def build(portfolio_id: uuid.UUID, session: AsyncSession) -> PortfolioContext:
    """Query DB and build a complete portfolio context for agent prompts."""
    result = await session.execute(
        select(Portfolio)
        .options(
            selectinload(Portfolio.positions).selectinload(Position.etf),
            selectinload(Portfolio.positions).selectinload(Position.theme),
        )
        .where(Portfolio.id == portfolio_id)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        return PortfolioContext(portfolio_id=portfolio_id, portfolio_name="Unknown")

    ctx = PortfolioContext(portfolio_id=portfolio_id, portfolio_name=portfolio.name)

    for pos in portfolio.positions:
        if not pos.is_active:
            continue

        latest_price = await _latest_price(session, pos.etf_id)
        current_value = float(pos.shares) * latest_price if latest_price else None
        invested = float(pos.invested_amount)
        pnl = (current_value - invested) if current_value else None
        pnl_pct = (pnl / invested * 100) if pnl and invested else None

        ctx.positions.append(PositionContext(
            etf_isin=pos.etf.isin,
            etf_name=pos.etf.name,
            ticker_yf=pos.etf.ticker_yf or pos.etf.isin,
            theme=pos.theme.name if pos.theme else None,
            shares=float(pos.shares),
            entry_price=float(pos.entry_price),
            entry_date=pos.entry_date,
            invested=invested,
            current_price=latest_price,
            current_value=round(current_value, 2) if current_value else None,
            pnl=round(pnl, 2) if pnl else None,
            pnl_pct=round(pnl_pct, 2) if pnl_pct else None,
            target_allocation=float(pos.target_allocation) if pos.target_allocation else None,
        ))

        if current_value:
            ctx.total_value += current_value
        ctx.total_invested += invested

    if ctx.total_value and ctx.total_invested:
        ctx.total_pnl = round(ctx.total_value - ctx.total_invested, 2)
        ctx.total_pnl_pct = round(ctx.total_pnl / ctx.total_invested * 100, 2)

    return ctx


async def build_market_summary(session: AsyncSession, days: int = 7) -> dict[str, list[dict]]:
    """Fetch recent prices for all ETFs and return a ticker-keyed dict of OHLCV rows."""
    cutoff = date.today() - timedelta(days=days)
    result = await session.execute(
        select(Price, ETF.ticker_yf)
        .join(ETF, ETF.id == Price.etf_id)
        .where(Price.date >= cutoff)
        .order_by(Price.date.desc())
    )
    rows = result.all()

    market: dict[str, list[dict]] = {}
    for price_row, ticker in rows:
        market.setdefault(ticker, []).append({
            "date": str(price_row.date),
            "close": float(price_row.close),
            "open": float(price_row.open) if price_row.open else None,
            "high": float(price_row.high) if price_row.high else None,
            "low": float(price_row.low) if price_row.low else None,
        })
    return market


def market_data_to_prompt(market: dict[str, list[dict]]) -> str:
    """Format market data dict as a readable prompt section."""
    lines = ["RECENT MARKET DATA (last 7 trading days):"]
    for ticker, rows in sorted(market.items()):
        if not rows:
            continue
        latest = rows[0]
        oldest = rows[-1]
        change_pct = ((latest["close"] - oldest["close"]) / oldest["close"] * 100) if oldest["close"] else 0
        lines.append(f"  {ticker}: {oldest['close']:.2f} -> {latest['close']:.2f} ({change_pct:+.2f}%)")
    return "\n".join(lines)


async def _latest_price(session: AsyncSession, etf_id: uuid.UUID) -> float | None:
    result = await session.execute(
        select(Price.close).where(Price.etf_id == etf_id).order_by(desc(Price.date)).limit(1)
    )
    row = result.scalar_one_or_none()
    return float(row) if row is not None else None


async def load_portfolio_themes(
    portfolio_id: uuid.UUID,
    session: AsyncSession,
) -> list[PortfolioTheme]:
    """Load all themes for a portfolio, ordered by sort_order."""
    result = await session.execute(
        select(PortfolioTheme)
        .where(PortfolioTheme.portfolio_id == portfolio_id)
        .order_by(PortfolioTheme.sort_order)
    )
    return list(result.scalars().all())


async def load_theme_etf_descriptions(
    portfolio_id: uuid.UUID,
    session: AsyncSession,
) -> dict[uuid.UUID, list[dict]]:
    """Build ETF metadata grouped by theme_id for dynamic agent prompts.

    Returns ``{theme_id: [{"ticker_yf", "isin", "name", "description", "top_holdings"}]}``.
    """
    result = await session.execute(
        select(Position)
        .options(
            selectinload(Position.etf).selectinload(ETF.holdings),
            selectinload(Position.etf).selectinload(ETF.allocations),
        )
        .where(Position.portfolio_id == portfolio_id, Position.is_active == True)  # noqa: E712
    )
    positions = result.scalars().all()

    grouped: dict[uuid.UUID, list[dict]] = {}
    seen: dict[uuid.UUID, set[uuid.UUID]] = {}

    for pos in positions:
        tid = pos.theme_id
        if tid is None:
            continue
        if tid not in grouped:
            grouped[tid] = []
            seen[tid] = set()
        if pos.etf_id in seen[tid]:
            continue
        seen[tid].add(pos.etf_id)

        etf = pos.etf
        top_holdings = sorted(
            (etf.holdings or []),
            key=lambda h: float(h.weight or 0),
            reverse=True,
        )[:10]

        grouped[tid].append({
            "ticker_yf": etf.ticker_yf or etf.isin,
            "isin": etf.isin,
            "name": etf.name,
            "description": etf.description or "",
            "investment_focus": etf.investment_focus or "",
            "top_holdings": [
                h.holding_name or h.holding_ticker or h.holding_isin or "?"
                for h in top_holdings
            ],
        })

    return grouped
