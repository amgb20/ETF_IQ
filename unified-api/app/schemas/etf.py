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


class QuoteResponse(BaseModel):
    isin: str
    last_close: float | None
    last_date: date | None
    previous_close: float | None
    day_change: float | None
    day_change_pct: float | None
    week_52_high: float | None
    week_52_low: float | None


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
    vol_5y: float | None
    ret_risk_1y: float | None
    ret_risk_3y: float | None
    ret_risk_5y: float | None
    max_dd_1y: float | None
    max_dd_3y: float | None
    max_dd_5y: float | None
    max_dd_inception: float | None

    index_name: str | None = None
    index_description: str | None = None
    investment_focus: str | None = None
    legal_structure: str | None = None
    strategy_risk: str | None = None
    sustainability: str | None = None
    fund_currency: str | None = None
    currency_risk: str | None = None
    distribution_frequency: str | None = None
    fund_provider: str | None = None
    top10_weight: float | None = None
    holdings_in_index: int | None = None

    holdings: list[HoldingOut] = []
    allocations: list[AllocationOut] = []

    model_config = {"from_attributes": True}
