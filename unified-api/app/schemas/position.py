from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class PositionCreate(BaseModel):
    etf_id: uuid.UUID
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    theme_id: uuid.UUID | None = None
    target_allocation: float | None = None
    layer_label: str | None = None


class PositionSell(BaseModel):
    shares: float
    price: float
    trade_date: date | None = None
    notes: str | None = None


class PositionResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    etf_id: uuid.UUID
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    is_active: bool
    exit_date: date | None = None
    exit_price: float | None = None
    target_allocation: float | None = None
    layer_label: str | None = None

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    id: uuid.UUID
    position_id: uuid.UUID
    type: str
    trade_date: date
    price: float
    shares: float
    amount: float
    notes: str | None = None
    created_at: datetime | None = None
    etf_isin: str | None = None
    etf_name: str | None = None
    ticker_yf: str | None = None
    realized_pnl: float | None = None
    realized_pnl_pct: float | None = None

    model_config = {"from_attributes": True}
