"""Pure-computation module for ETF correlation analysis.

Provides price-based Pearson correlation and weighted holdings overlap.
No LLM calls — just math.
"""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import date, timedelta
from itertools import combinations

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.etf import ETFHolding
from app.models.price import Price

logger = logging.getLogger(__name__)


async def compute_price_correlations(
    db: AsyncSession,
    etf_ids: list[uuid.UUID],
    lookback_days: int = 365,
) -> list[dict]:
    """Compute pairwise Pearson correlation on daily returns.

    Returns list of dicts: {etf_id_a, etf_id_b, correlation}.
    """
    cutoff = date.today() - timedelta(days=lookback_days)

    result = await db.execute(
        select(Price.etf_id, Price.date, Price.close)
        .where(Price.etf_id.in_(etf_ids), Price.date >= cutoff)
        .order_by(Price.etf_id, Price.date)
    )
    rows = result.all()

    # Group close prices by etf_id → {date: close}
    prices_by_etf: dict[uuid.UUID, dict[date, float]] = defaultdict(dict)
    for etf_id, dt, close in rows:
        prices_by_etf[etf_id][dt] = float(close)

    # Compute daily returns per ETF
    returns_by_etf: dict[uuid.UUID, dict[date, float]] = {}
    for etf_id, date_prices in prices_by_etf.items():
        sorted_dates = sorted(date_prices.keys())
        returns: dict[date, float] = {}
        for i in range(1, len(sorted_dates)):
            prev_close = date_prices[sorted_dates[i - 1]]
            curr_close = date_prices[sorted_dates[i]]
            if prev_close and prev_close != 0:
                returns[sorted_dates[i]] = (curr_close - prev_close) / prev_close
        returns_by_etf[etf_id] = returns

    # Pairwise correlation
    correlations: list[dict] = []
    for id_a, id_b in combinations(etf_ids, 2):
        if id_a not in returns_by_etf or id_b not in returns_by_etf:
            continue

        common_dates = sorted(set(returns_by_etf[id_a].keys()) & set(returns_by_etf[id_b].keys()))
        if len(common_dates) < 30:
            # Not enough data for meaningful correlation
            continue

        arr_a = np.array([returns_by_etf[id_a][d] for d in common_dates])
        arr_b = np.array([returns_by_etf[id_b][d] for d in common_dates])

        corr_matrix = np.corrcoef(arr_a, arr_b)
        corr_value = float(corr_matrix[0, 1])

        if not np.isnan(corr_value):
            correlations.append(
                {
                    "etf_id_a": id_a,
                    "etf_id_b": id_b,
                    "correlation": round(corr_value, 4),
                }
            )

    return correlations


async def compute_holdings_overlap(
    db: AsyncSession,
    etf_ids: list[uuid.UUID],
) -> list[dict]:
    """Compute weighted holdings overlap for each ETF pair.

    overlap_pct = sum(min(weight_a, weight_b)) for shared holdings.
    Matches by holding_isin when available, falls back to normalised
    holding_name so that scraped data without ISINs still gets compared.
    Returns list of dicts: {etf_id_a, etf_id_b, overlap_pct, shared_count}.
    """
    result = await db.execute(
        select(
            ETFHolding.etf_id,
            ETFHolding.holding_isin,
            ETFHolding.holding_name,
            ETFHolding.weight,
        ).where(ETFHolding.etf_id.in_(etf_ids))
    )
    rows = result.all()

    def _holding_key(isin: str | None, name: str | None) -> str | None:
        """Return ISIN if available, otherwise a lowercased name."""
        if isin:
            return isin
        if name:
            return name.strip().lower()
        return None

    holdings_map: dict[uuid.UUID, dict[str, float]] = defaultdict(dict)
    for etf_id, isin, name, weight in rows:
        key = _holding_key(isin, name)
        if key and weight is not None:
            holdings_map[etf_id][key] = float(weight)

    overlaps: list[dict] = []
    for id_a, id_b in combinations(etf_ids, 2):
        if id_a not in holdings_map or id_b not in holdings_map:
            continue

        holdings_a = holdings_map[id_a]
        holdings_b = holdings_map[id_b]
        shared_keys = set(holdings_a.keys()) & set(holdings_b.keys())

        if not shared_keys:
            overlaps.append(
                {
                    "etf_id_a": id_a,
                    "etf_id_b": id_b,
                    "overlap_pct": 0.0,
                    "shared_count": 0,
                }
            )
            continue

        weighted_overlap = sum(
            min(holdings_a[k], holdings_b[k]) for k in shared_keys
        )
        overlap_pct = round(weighted_overlap * 100, 2)

        overlaps.append(
            {
                "etf_id_a": id_a,
                "etf_id_b": id_b,
                "overlap_pct": overlap_pct,
                "shared_count": len(shared_keys),
            }
        )

    return overlaps


def flag_correlated_pairs(
    price_correlations: list[dict],
    holdings_overlaps: list[dict],
    threshold: float = 0.8,
) -> list[dict]:
    """Flag pairs where price correlation > threshold OR holdings overlap > threshold*100."""
    flagged: list[dict] = []
    seen: set[tuple] = set()

    for pc in price_correlations:
        if pc["correlation"] > threshold:
            pair_key = (str(pc["etf_id_a"]), str(pc["etf_id_b"]), "price")
            if pair_key not in seen:
                seen.add(pair_key)
                flagged.append(
                    {
                        "etf_id_a": pc["etf_id_a"],
                        "etf_id_b": pc["etf_id_b"],
                        "reason": f"price_correlation > {threshold}",
                        "value": pc["correlation"],
                    }
                )

    threshold_pct = threshold * 100
    for ho in holdings_overlaps:
        if ho["overlap_pct"] > threshold_pct:
            pair_key = (str(ho["etf_id_a"]), str(ho["etf_id_b"]), "holdings")
            if pair_key not in seen:
                seen.add(pair_key)
                flagged.append(
                    {
                        "etf_id_a": ho["etf_id_a"],
                        "etf_id_b": ho["etf_id_b"],
                        "reason": f"holdings_overlap > {threshold_pct}%",
                        "value": ho["overlap_pct"],
                    }
                )

    return flagged
