from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class ReportCreate(BaseModel):
    portfolio_id: uuid.UUID
    type: str = "weekly"
    sections: list[str] | None = None
    date_from: date | None = None
    date_to: date | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    type: str
    status: str
    generated_at: datetime | None = None
    summary_sentence: str | None = None
    file_path: str | None = None
    research_mode: str | None = None

    model_config = {"from_attributes": True}


class ReportStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    summary_sentence: str | None = None
    current_step: str | None = None

    model_config = {"from_attributes": True}
