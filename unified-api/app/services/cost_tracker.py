"""Cost metering -- aggregate Gemini token usage from agent_outputs."""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentOutput
from app.models.portfolio import Portfolio

logger = logging.getLogger(__name__)

GEMINI_INPUT_COST_PER_1K = 0.00125
GEMINI_OUTPUT_COST_PER_1K = 0.005


async def get_monthly_costs(
    session: AsyncSession,
    month: date | None = None,
    user_id: str | None = None,
) -> list[dict]:
    """Aggregate token costs from agent_outputs grouped by portfolio owner."""
    target = month or date.today()
    year = target.year
    month_num = target.month

    stmt = (
        select(
            Portfolio.user_id,
            Portfolio.name.label("portfolio_name"),
            func.count(AgentOutput.id).label("total_runs"),
            func.coalesce(func.sum(AgentOutput.prompt_tokens), 0).label("total_prompt_tokens"),
            func.coalesce(func.sum(AgentOutput.completion_tokens), 0).label("total_completion_tokens"),
        )
        .join(Portfolio, AgentOutput.portfolio_id == Portfolio.id)
        .where(
            extract("year", AgentOutput.created_at) == year,
            extract("month", AgentOutput.created_at) == month_num,
        )
        .group_by(Portfolio.user_id, Portfolio.name)
        .order_by(func.sum(AgentOutput.prompt_tokens).desc())
    )

    if user_id:
        stmt = stmt.where(Portfolio.user_id == user_id)

    result = await session.execute(stmt)
    rows = result.all()

    costs = []
    for row in rows:
        prompt_cost = int(row.total_prompt_tokens) / 1000 * GEMINI_INPUT_COST_PER_1K
        completion_cost = int(row.total_completion_tokens) / 1000 * GEMINI_OUTPUT_COST_PER_1K
        total_cost = prompt_cost + completion_cost

        costs.append({
            "user_id": str(row.user_id),
            "portfolio_name": row.portfolio_name,
            "total_runs": row.total_runs,
            "prompt_tokens": int(row.total_prompt_tokens),
            "completion_tokens": int(row.total_completion_tokens),
            "estimated_cost_usd": round(total_cost, 4),
            "month": f"{year}-{month_num:02d}",
        })

    return costs
