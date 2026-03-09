from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class HoldingOut(BaseModel):
    holding_name: str | None
    holding_isin: str | None
    holding_ticker: str | None
    weight: float | None

    model_config = {"from_attributes": True}


class AllocationOut(BaseModel):
    allocation_type: str
    name: str
    percentage: float | None

    model_config = {"from_attributes": True}


class ETFListItem(BaseModel):
    id: uuid.UUID
    isin: str
    ticker_yf: str | None
    name: str
    currency: str | None
    exchange: str | None

    model_config = {"from_attributes": True}


class ETFDiscoverItem(BaseModel):
    isin: str
    name: str
    ticker_yf: str | None = None
    currency: str | None = None
    exchange: str | None = None
    ter: float | None = None
    aum_eur: int | None = None
    domicile: str | None = None
    asset_class: str | None = None


class ETFDetailResponse(BaseModel):
    id: uuid.UUID
    isin: str
    ticker_yf: str | None
    name: str
    currency: str | None
    exchange: str | None
    ter: float | None
    aum_eur: int | None
    inception_date: date | None
    domicile: str | None
    replication: str | None
    distribution: str | None
    description: str | None
    holdings_count: int | None
    vol_1y: float | None
    vol_3y: float | None
    ret_risk_1y: float | None
    max_dd_1y: float | None
    holdings: list[HoldingOut] = []
    allocations: list[AllocationOut] = []

    model_config = {"from_attributes": True}
