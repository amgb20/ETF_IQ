"""Weekly agent orchestrator — full pipeline with all agents."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import date

from app.agents.judge import JudgeAgent
from app.agents.research import AIStackAgent, GoldAgent, DefenceAgent, MacroAgent
from app.agents.risk_assessor import RiskAssessorAgent
from app.agents.event_mapper import EventMapperAgent
from app.agents.recommender import RecommenderAgent

logger = logging.getLogger(__name__)


class WeeklyOrchestrator:
    @staticmethod
    async def run(
        portfolio_id: uuid.UUID,
        run_date: date | None = None,
        run_type: str = "standard",
    ) -> dict:
        """Execute the full weekly agent cycle.

        1. Run Agent 8 (Judge) — evaluate last week's predictions
        2. Run Agents 1-4 in parallel with reflection context
        3. Run Agent 5 (Risk) with research outputs
        4. Run Agent 6 (Events) + Agent 7 (Recommender) in parallel
        5. Email digest stub (Phase 6)
        """
        run_date = run_date or date.today()
        logger.info("WeeklyOrchestrator starting for portfolio %s (date=%s, type=%s)", portfolio_id, run_date, run_type)

        # Step 1: Judge evaluates last week
        judge = JudgeAgent()
        evaluations = await judge.evaluate(portfolio_id, run_date)
        logger.info("Judge evaluated %d outputs", len(evaluations))

        # Step 2: Agents 1-4 in parallel
        agents = [AIStackAgent(), GoldAgent(), DefenceAgent(), MacroAgent()]
        results = await asyncio.gather(
            *[agent.run(portfolio_id, run_date, run_type) for agent in agents],
            return_exceptions=True,
        )

        research_outputs = []
        successes = 0
        failures = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("Agent %s failed: %s", agents[i].agent_name, result, exc_info=result)
                failures += 1
            else:
                research_outputs.append(result)
                successes += 1

        # Step 3: Agent 5 (Risk) with research context
        risk_output = None
        try:
            risk_output = await RiskAssessorAgent().run(
                portfolio_id, run_date, run_type,
                research_outputs=research_outputs,
            )
            successes += 1
        except Exception as exc:
            logger.error("RiskAssessorAgent failed: %s", exc, exc_info=exc)
            failures += 1

        # Step 4: Agent 6 (Events) + Agent 7 (Recommender) in parallel
        event_mapper = EventMapperAgent()
        recommender = RecommenderAgent()

        phase4_results = await asyncio.gather(
            event_mapper.extract(portfolio_id, run_date, research_outputs),
            recommender.run(
                portfolio_id, run_date, run_type,
                research_outputs=research_outputs,
                risk_output=risk_output,
            ),
            return_exceptions=True,
        )

        for i, r in enumerate(phase4_results):
            agent_label = ["EventMapper", "Recommender"][i]
            if isinstance(r, Exception):
                logger.error("%s failed: %s", agent_label, r, exc_info=r)
                failures += 1
            else:
                successes += 1

        # Step 5: Email digest stub (Phase 6)
        logger.info("Email digest stub — wired in Phase 6")

        summary = {
            "portfolio_id": str(portfolio_id),
            "run_date": str(run_date),
            "run_type": run_type,
            "judge_evaluations": len(evaluations),
            "agents_succeeded": successes,
            "agents_failed": failures,
        }
        logger.info("WeeklyOrchestrator complete: %s", summary)
        return summary
