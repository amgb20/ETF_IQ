from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    portfolio_id: uuid.UUID
    etf_id: uuid.UUID
    type: str = Field(..., pattern="^(price_above|price_below|pct_change|volatility)$")
    threshold: float


class AlertUpdate(BaseModel):
    threshold: float | None = None
    is_active: bool | None = None


class AlertEventResponse(BaseModel):
    id: uuid.UUID
    alert_id: uuid.UUID
    triggered_at: datetime | None = None
    actual_value: float | None = None
    message: str | None = None

    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    type: str
    etf_id: uuid.UUID | None = None
    threshold: float
    is_active: bool
    last_triggered_at: datetime | None = None
    trigger_count: int
    created_at: datetime | None = None
    events: list[AlertEventResponse] = []

    model_config = {"from_attributes": True}
