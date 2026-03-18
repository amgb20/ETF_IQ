"""Agent 7 — Action Recommender.

Synthesises research, risk assessment, and judge evaluations into actionable
portfolio recommendations. Predictions are stored for subsequent Judge evaluation.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date

from app.agents import llm_client
from app.agents.base_agent import PREDICTION_INSTRUCTION, BaseAgent
from app.agents.context_builder import PortfolioContext, build, build_market_summary, market_data_to_prompt
from app.agents.prediction_parser import parse as parse_predictions
from app.agents.prompts.v1.agent7_recommender import SYSTEM_PROMPT
from app.database import async_session
from app.models.agent import AgentOutput

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "DISCLAIMER: This is informational only. Not financial advice. "
    "Always consult a qualified financial advisor before making investment decisions."
)


class RecommenderAgent(BaseAgent):
    agent_name = "action_recommender"
    covered_tickers = ["XAIX.L", "SMGB.L", "VPNG.L", "URNG.L", "AUCP.L", "SGLN.L", "ARMG.L"]

    def build_prompt(
        self,
        context: PortfolioContext,
        market_summary: str,
        past_output: AgentOutput | None,
        judge_eval: dict | None,
        **kwargs,
    ) -> str:
        parts = [SYSTEM_PROMPT]

        if past_output and judge_eval:
            parts.append(self._build_reflection_block(past_output, judge_eval))

        parts.append(context.to_prompt_string())
        parts.append(market_summary)

        if "research_summaries" in kwargs:
            parts.append(kwargs["research_summaries"])
        if "risk_summary" in kwargs:
            parts.append(kwargs["risk_summary"])
        if "judge_summaries" in kwargs:
            parts.append(kwargs["judge_summaries"])

        parts.append(PREDICTION_INSTRUCTION)
        return "\n\n".join(parts)

    async def run(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
        run_type: str = "standard",
        research_outputs: list[AgentOutput] | None = None,
        risk_output: AgentOutput | None = None,
    ) -> AgentOutput:
        """Run the recommender with full context from prior agents."""
        import time as _time

        t0 = _time.perf_counter()
        logger.info(
            "RecommenderAgent starting for portfolio %s (run_date=%s, run_type=%s)",
            portfolio_id,
            run_date,
            run_type,
        )

        async with async_session() as session:
            logger.debug("RecommenderAgent: building context...")
            ctx = await build(portfolio_id, session)
            market = await build_market_summary(session)
            market_str = market_data_to_prompt(market)

            research_str = ""
            if research_outputs:
                parts = []
                for o in research_outputs:
                    parts.append(f"--- {o.agent_name} ---\n{o.summary[:1200]}")
                research_str = "RESEARCH AGENT OUTPUTS:\n" + "\n\n".join(parts)

            risk_str = ""
            if risk_output:
                risk_str = f"RISK ASSESSMENT (Agent 5):\n{risk_output.summary[:1500]}"

            past_output = await self.load_past_output(session, portfolio_id, run_date)
            judge_eval = past_output.judge_evaluation if past_output and past_output.judge_evaluation else None

            prompt = self.build_prompt(
                ctx,
                market_str,
                past_output,
                judge_eval,
                research_summaries=research_str,
                risk_summary=risk_str,
            )

            logger.info("RecommenderAgent: calling LLM...")
            config = llm_client.DEEP_RESEARCH_CONFIG if run_type == "deep_research" else llm_client.STANDARD_CONFIG
            response = await llm_client.generate(prompt, config=config)
            predictions = parse_predictions(response.text)

            summary = response.text
            if DISCLAIMER not in summary:
                summary = f"{DISCLAIMER}\n\n{summary}"

            logger.debug("RecommenderAgent: storing output...")
            output = await self.store_output(
                session=session,
                portfolio_id=portfolio_id,
                run_date=run_date,
                run_type=run_type,
                summary=summary,
                predictions=predictions,
                reflection=f"Reflected on Week {past_output.run_date} evaluation."
                if past_output and judge_eval
                else None,
                research_mode=run_type,
                model_used=response.model_used,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                latency_ms=response.latency_ms,
                sources_cited=response.sources_cited,
            )

            elapsed_ms = int((_time.perf_counter() - t0) * 1000)
            logger.info(
                "RecommenderAgent completed for portfolio %s (predictions=%d, elapsed=%dms)",
                portfolio_id,
                len(predictions),
                elapsed_ms,
            )
            return output
