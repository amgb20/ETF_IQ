from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ChartEventResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    agent_output_id: uuid.UUID | None = None
    event_date: date
    headline: str
    description: str | None = None
    source_url: str | None = None
    tickers: list[str]
    themes: list[str] | None = None
    sentiment: str | None = None
    importance: int | None = None
    source_agent: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
