from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

import numpy as np
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import RequireAuth, verify_portfolio_owner
from app.database import get_db
from app.models import ETF, Position, Price

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

TRADING_DAYS_PER_YEAR = 252


class ETFRiskMetric(BaseModel):
    etf_id: str
    isin: str
    ticker_yf: str | None
    name: str
    annualized_return: float | None
    annualized_volatility: float | None
    max_drawdown: float | None
    sharpe_ratio: float | None


class RiskMetricsResponse(BaseModel):
    etfs: list[ETFRiskMetric]
    correlation: dict[str, dict[str, float]]


@router.get("/risk-metrics", response_model=RiskMetricsResponse)
async def get_risk_metrics(
    portfolio_id: uuid.UUID = Query(...),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    positions = (
        (await db.execute(select(Position).where(Position.portfolio_id == portfolio_id, Position.is_active == True)))
        .scalars()
        .all()
    )

    if not positions:
        return RiskMetricsResponse(etfs=[], correlation={})

    etf_ids = [p.etf_id for p in positions]
    etfs_result = await db.execute(select(ETF).where(ETF.id.in_(etf_ids)))
    etf_map = {e.id: e for e in etfs_result.scalars().all()}

    one_year_ago = date.today() - timedelta(days=365)
    returns_by_isin: dict[str, np.ndarray] = {}
    dates_by_isin: dict[str, list[date]] = {}
    metrics: list[ETFRiskMetric] = []

    for eid in etf_ids:
        etf = etf_map.get(eid)
        if not etf:
            continue

        prices_result = await db.execute(
            select(Price).where(and_(Price.etf_id == eid, Price.date >= one_year_ago)).order_by(Price.date)
        )
        rows = prices_result.scalars().all()

        if len(rows) < 2:
            metrics.append(
                ETFRiskMetric(
                    etf_id=str(eid),
                    isin=etf.isin,
                    ticker_yf=etf.ticker_yf,
                    name=etf.name,
                    annualized_return=None,
                    annualized_volatility=None,
                    max_drawdown=None,
                    sharpe_ratio=None,
                )
            )
            continue

        closes = np.array([float(r.close) for r in rows])
        daily_ret = np.diff(closes) / closes[:-1]

        ann_ret = float((1 + np.mean(daily_ret)) ** TRADING_DAYS_PER_YEAR - 1)
        ann_vol = float(np.std(daily_ret, ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR))
        sharpe = float(ann_ret / ann_vol) if ann_vol > 0 else None

        cummax = np.maximum.accumulate(closes)
        drawdowns = (closes - cummax) / cummax
        max_dd = float(np.min(drawdowns))

        returns_by_isin[etf.isin] = daily_ret
        dates_by_isin[etf.isin] = [r.date for r in rows]

        metrics.append(
            ETFRiskMetric(
                etf_id=str(eid),
                isin=etf.isin,
                ticker_yf=etf.ticker_yf,
                name=etf.name,
                annualized_return=round(ann_ret * 100, 2),
                annualized_volatility=round(ann_vol * 100, 2),
                max_drawdown=round(max_dd * 100, 2),
                sharpe_ratio=round(sharpe, 2) if sharpe is not None else None,
            )
        )

    correlation: dict[str, dict[str, float]] = {}
    isins = list(returns_by_isin.keys())
    if len(isins) >= 2:
        all_dates = set()
        for d_list in dates_by_isin.values():
            all_dates.update(d_list)
        aligned: dict[str, dict[date, float]] = {}
        for isin_key, rets in returns_by_isin.items():
            date_list = dates_by_isin[isin_key]
            aligned[isin_key] = {d: float(r) for d, r in zip(date_list[1:], rets)}

        shared_dates = sorted(set.intersection(*(set(a.keys()) for a in aligned.values())))

        if len(shared_dates) >= 10:
            matrix_data = np.array([[aligned[isin_key][d] for d in shared_dates] for isin_key in isins])
            corr_matrix = np.corrcoef(matrix_data)
            for i, a in enumerate(isins):
                correlation[a] = {}
                for j, b in enumerate(isins):
                    correlation[a][b] = round(float(corr_matrix[i, j]), 4)

    logger.info("GET /analytics/risk-metrics  portfolio=%s  etfs=%d", portfolio_id, len(metrics))
    return RiskMetricsResponse(etfs=metrics, correlation=correlation)
