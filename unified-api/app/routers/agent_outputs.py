from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import RequireAuth, verify_portfolio_owner
from app.database import get_db
from app.models.agent import AgentOutput
from app.schemas.agent_output import AgentOutputResponse

router = APIRouter(prefix="/agent-outputs", tags=["agent-outputs"])


class AgentScoreEntry(BaseModel):
    agent_name: str
    run_date: date
    score: float


@router.get("/scores", response_model=list[AgentScoreEntry])
async def get_agent_scores(
    portfolio_id: uuid.UUID = Query(...),
    weeks: int = Query(12, ge=1, le=52),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    cutoff = date.today() - timedelta(weeks=weeks)

    result = await db.execute(
        select(
            AgentOutput.agent_name,
            AgentOutput.run_date,
            AgentOutput.judge_overall_score,
        )
        .where(
            AgentOutput.portfolio_id == portfolio_id,
            AgentOutput.judge_overall_score.isnot(None),
            AgentOutput.run_date >= cutoff,
        )
        .order_by(AgentOutput.run_date, AgentOutput.agent_name)
    )
    rows = result.all()
    return [AgentScoreEntry(agent_name=r[0], run_date=r[1], score=float(r[2])) for r in rows]


@router.get("", response_model=list[AgentOutputResponse])
async def list_agent_outputs(
    portfolio_id: uuid.UUID = Query(...),
    agent: str | None = Query(None),
    weeks: int = Query(12, ge=1, le=52),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    cutoff = date.today() - timedelta(weeks=weeks)

    stmt = (
        select(AgentOutput)
        .where(
            AgentOutput.portfolio_id == portfolio_id,
            AgentOutput.run_date >= cutoff,
        )
        .order_by(desc(AgentOutput.run_date), AgentOutput.agent_name)
    )

    if agent:
        stmt = stmt.where(AgentOutput.agent_name == agent)

    result = await db.execute(stmt)
    outputs = result.scalars().all()
    return [AgentOutputResponse.model_validate(o) for o in outputs]
