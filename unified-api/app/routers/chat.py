"""Chat endpoints -- SSE streaming + session management."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.chat_agent import ChatAgent
from app.auth.dependencies import RequireAuth, verify_portfolio_owner
from app.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.schemas.chat import (
    ChatMessageResponse,
    ChatRequest,
    ChatSessionBatchDelete,
    ChatSessionResponse,
    ChatSessionUpdate,
)

router = APIRouter(prefix="/chat", tags=["chat"])

SNIPPET_LENGTH = 200


async def _sse_generator(agent: ChatAgent, message: str):
    """Wrap ChatAgent.send_message() as SSE text/event-stream."""
    async for event in agent.send_message(message):
        yield f"data: {json.dumps(event)}\n\n"


@router.post("")
async def send_chat_message(
    body: ChatRequest,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(body.portfolio_id, user, db)

    agent = ChatAgent(
        portfolio_id=body.portfolio_id,
        session_id=body.session_id,
    )
    return StreamingResponse(
        _sse_generator(agent, body.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    portfolio_id: uuid.UUID = Query(...),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    snippet_sq = (
        select(func.left(ChatMessage.content, SNIPPET_LENGTH))
        .where(
            ChatMessage.session_id == ChatSession.id,
            ChatMessage.role == "assistant",
        )
        .order_by(desc(ChatMessage.created_at))
        .limit(1)
        .correlate(ChatSession)
        .scalar_subquery()
        .label("last_message_snippet")
    )

    result = await db.execute(
        select(ChatSession, snippet_sq)
        .where(ChatSession.portfolio_id == portfolio_id)
        .order_by(desc(ChatSession.last_message_at))
    )
    rows = result.all()
    return [
        ChatSessionResponse(
            id=session.id,
            portfolio_id=session.portfolio_id,
            title=session.title,
            started_at=session.started_at,
            last_message_at=session.last_message_at,
            last_message_snippet=snippet,
        )
        for session, snippet in rows
    ]


@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: ChatSessionUpdate,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await verify_portfolio_owner(session.portfolio_id, user, db)

    session.title = body.title.strip()[:120]
    await db.commit()
    await db.refresh(session)
    return ChatSessionResponse.model_validate(session)


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await verify_portfolio_owner(session.portfolio_id, user, db)

    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
    await db.commit()


@router.post("/sessions/batch-delete", status_code=204)
async def batch_delete_sessions(
    body: ChatSessionBatchDelete,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    if not body.session_ids:
        return

    result = await db.execute(
        select(ChatSession).where(ChatSession.id.in_(body.session_ids))
    )
    sessions = result.scalars().all()
    for s in sessions:
        await verify_portfolio_owner(s.portfolio_id, user, db)

    ids = [s.id for s in sessions]
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(ids)))
    await db.execute(delete(ChatSession).where(ChatSession.id.in_(ids)))
    await db.commit()


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def list_messages(
    session_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if session:
        await verify_portfolio_owner(session.portfolio_id, user, db)

    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [ChatMessageResponse.model_validate(m) for m in messages]
