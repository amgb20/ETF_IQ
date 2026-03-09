from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class AgentOutputResponse(BaseModel):
    id: uuid.UUID
    agent_name: str
    run_date: date
    run_type: str
    summary: str
    predictions: list[dict[str, Any]] | None = None
    reflection: str | None = None
    judge_overall_score: float | None = None
    judge_evaluation: dict[str, Any] | None = None
    research_mode: str | None = None
    model_used: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    latency_ms: int | None = None
    sources_cited: list[dict[str, Any]] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
