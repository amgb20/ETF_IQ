"""Report History Search Tool -- pg_trgm keyword search on agent_outputs."""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import select, desc, text, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentOutput

logger = logging.getLogger(__name__)


class ReportHistoryTool:
    """Searches past agent outputs for relevant information using keyword matching."""

    @staticmethod
    async def search(
        session: AsyncSession,
        portfolio_id: str,
        query: str,
        agent_name: str | None = None,
        weeks_back: int = 12,
    ) -> list[dict]:
        cutoff = date.today() - timedelta(weeks=weeks_back)
        keywords = [w.strip().lower() for w in query.split() if len(w.strip()) > 2]

        if not keywords:
            return []

        like_clauses = [AgentOutput.summary.ilike(f"%{kw}%") for kw in keywords[:5]]

        stmt = (
            select(AgentOutput)
            .where(
                AgentOutput.portfolio_id == portfolio_id,
                AgentOutput.run_date >= cutoff,
            )
            .order_by(desc(AgentOutput.run_date))
        )

        if agent_name:
            stmt = stmt.where(AgentOutput.agent_name == agent_name)

        from sqlalchemy import or_
        stmt = stmt.where(or_(*like_clauses))
        stmt = stmt.limit(5)

        result = await session.execute(stmt)
        outputs = result.scalars().all()

        results = []
        for o in outputs:
            results.append({
                "agent_name": o.agent_name,
                "run_date": str(o.run_date),
                "summary_excerpt": o.summary[:500],
                "judge_overall_score": float(o.judge_overall_score) if o.judge_overall_score else None,
                "predictions": o.predictions,
            })

        logger.info(
            "ReportHistoryTool: query=%r agent=%s found=%d results",
            query[:50], agent_name, len(results),
        )
        return results
