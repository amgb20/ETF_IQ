"""Pydantic schemas for the onboarding flow."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


# ── Requests ────────────────────────────────────────────────────────


class ClassifyThemesRequest(BaseModel):
    etf_ids: list[uuid.UUID]


class CorrelationsRequest(BaseModel):
    etf_ids: list[uuid.UUID]
    lookback_days: int = 365


class CorrelatedPairInput(BaseModel):
    etf_id_a: uuid.UUID
    etf_id_b: uuid.UUID
    price_correlation: float | None = None
    holdings_overlap_pct: float | None = None


class AdvisorRequest(BaseModel):
    correlated_pairs: list[CorrelatedPairInput]
    all_etf_ids: list[uuid.UUID]


class PositionInput(BaseModel):
    etf_id: uuid.UUID
    shares: float
    entry_price: float
    entry_date: date
    invested_amount: float
    target_allocation: float | None = None


class ThemeInput(BaseModel):
    name: str
    color: str
    research_agent: str | None = None
    positions: list[PositionInput]


class OnboardingCompleteRequest(BaseModel):
    portfolio_name: str
    description: str | None = None
    themes: list[ThemeInput]


# ── Responses ───────────────────────────────────────────────────────


class ThemeClassification(BaseModel):
    label: str
    color: str
    etf_ids: list[uuid.UUID]
    etf_isins: list[str]
    research_agent: str | None = None


class ClassifyThemesResponse(BaseModel):
    themes: list[ThemeClassification]


class PairCorrelation(BaseModel):
    etf_id_a: uuid.UUID
    etf_id_b: uuid.UUID
    isin_a: str
    isin_b: str
    name_a: str
    name_b: str
    correlation: float


class PairOverlap(BaseModel):
    etf_id_a: uuid.UUID
    etf_id_b: uuid.UUID
    isin_a: str
    isin_b: str
    name_a: str
    name_b: str
    overlap_pct: float
    shared_holdings_count: int


class FlaggedPair(BaseModel):
    etf_id_a: uuid.UUID
    etf_id_b: uuid.UUID
    isin_a: str
    isin_b: str
    reason: str
    value: float


class CorrelationsResponse(BaseModel):
    price_correlations: list[PairCorrelation]
    holdings_overlaps: list[PairOverlap]
    flagged_pairs: list[FlaggedPair]


class RankedETF(BaseModel):
    etf_id: uuid.UUID
    isin: str
    name: str
    rank: int
    score_breakdown: dict


class PairRanking(BaseModel):
    pair_etf_ids: list[uuid.UUID]
    ranked_etfs: list[RankedETF]
    reasoning: str


class SuggestedETF(BaseModel):
    isin: str
    name: str
    ter: float | None = None
    vol_1y: float | None = None
    ret_risk_1y: float | None = None
    why: str


class ReplacementSuggestion(BaseModel):
    discard_etf_id: uuid.UUID
    theme: str
    suggested_etfs: list[SuggestedETF]
    reasoning: str


class AdvisorResponse(BaseModel):
    rankings: list[PairRanking]
    replacements: list[ReplacementSuggestion]


class OnboardingStatusResponse(BaseModel):
    is_onboarded: bool
