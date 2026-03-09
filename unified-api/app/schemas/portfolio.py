from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


# ── Create / Update ──────────────────────────────────────────────────

class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None


# ── Responses ────────────────────────────────────────────────────────

class PositionBrief(BaseModel):
    id: uuid.UUID
    etf_isin: str
    etf_name: str
    ticker_yf: str | None
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    current_price: float | None = None
    current_value: float | None = None
    pnl: float | None = None
    pnl_pct: float | None = None
    target_allocation: float | None = None
    theme_name: str | None = None

    model_config = {"from_attributes": True}


class PortfolioResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime | None
    positions: list[PositionBrief] = []
    total_value: float | None = None
    total_pnl: float | None = None
    total_pnl_pct: float | None = None

    model_config = {"from_attributes": True}


class SnapshotResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    date: date
    total_value: float | None
    total_pnl: float | None
    total_pnl_pct: float | None
    allocations: dict[str, Any] | None

    model_config = {"from_attributes": True}


class OverlapResponse(BaseModel):
    overlap: dict[str, dict[str, list[str]]]
