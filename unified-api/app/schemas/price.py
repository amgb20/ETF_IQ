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
