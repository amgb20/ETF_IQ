from __future__ import annotations

import uuid
from datetime import date

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


class PositionResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    etf_id: uuid.UUID
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    is_active: bool
    target_allocation: float | None
    layer_label: str | None

    model_config = {"from_attributes": True}
