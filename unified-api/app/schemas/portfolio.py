from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

# ── Create / Update ──────────────────────────────────────────────────


class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None


class ThemeCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class ThemeUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class PositionThemeUpdate(BaseModel):
    theme_id: uuid.UUID | None


# ── Responses ────────────────────────────────────────────────────────


class ThemeBrief(BaseModel):
    id: uuid.UUID
    name: str
    color: str | None
    research_agent: str | None
    sort_order: int
    position_count: int = 0

    model_config = {"from_attributes": True}


class PositionBrief(BaseModel):
    id: uuid.UUID
    etf_id: uuid.UUID
    etf_isin: str
    etf_name: str
    ticker_yf: str | None
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    is_active: bool = True
    current_price: float | None = None
    current_value: float | None = None
    pnl: float | None = None
    pnl_pct: float | None = None
    target_allocation: float | None = None
    theme_name: str | None = None
    theme_color: str | None = None

    model_config = {"from_attributes": True}


class PortfolioResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime | None
    positions: list[PositionBrief] = []
    themes: list[ThemeBrief] = []
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
