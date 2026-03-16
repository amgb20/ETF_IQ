from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class PriceRow(BaseModel):
    etf_id: uuid.UUID
    date: date
    open: float | None
    high: float | None
    low: float | None
    close: float
    volume: int | None

    model_config = {"from_attributes": True}


class PriceSeriesResponse(BaseModel):
    etf_id: uuid.UUID
    prices: list[PriceRow]


class IntradayRow(BaseModel):
    timestamp: str  # ISO 8601 with time component
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float
    volume: int | None = None


class IntradaySeriesResponse(BaseModel):
    ticker: str
    interval: str
    prices: list[IntradayRow]


class PriceStatusResponse(BaseModel):
    latest_date: str | None
    needs_sync: bool
