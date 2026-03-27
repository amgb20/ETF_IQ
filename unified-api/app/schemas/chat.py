from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ChatRequest(BaseModel):
    portfolio_id: uuid.UUID
    session_id: uuid.UUID | None = None
    message: str


class ChatSessionUpdate(BaseModel):
    title: str


class ChatSessionBatchDelete(BaseModel):
    session_ids: list[uuid.UUID]


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    title: str | None = None
    started_at: datetime | None = None
    last_message_at: datetime | None = None
    last_message_snippet: str | None = None

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    tools_used: list[dict[str, Any]] | None = None
    sources: list[dict[str, Any]] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
