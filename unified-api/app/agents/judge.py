"""Agent 8 — LLM-as-Judge Evaluator.

Evaluates previous week's predictions from research agents and writes
accuracy scores back to their agent_outputs rows.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.context_builder import build, build_market_summary, market_data_to_prompt
from app.agents.prompts.v1.agent8_judge import SYSTEM_PROMPT
from app.database import async_session
from app.models.agent import AgentOutput

logger = logging.getLogger(__name__)

EVALUATED_AGENTS = {"ai_stack_analyst", "gold_analyst", "defence_analyst", "macro_analyst", "action_recommender"}


class JudgeAgent:
    agent_name = "judge"

    async def evaluate(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
    ) -> list[dict]:
        """Evaluate all unevaluated predictions from the previous week."""
        async with async_session() as session:
            previous_outputs = await self._load_unevaluated(session, portfolio_id, run_date)

            if not previous_outputs:
                logger.info("Judge: no unevaluated outputs found for portfolio %s — cold start or already evaluated", portfolio_id)
                return []

            ctx = await build(portfolio_id, session)
            market = await build_market_summary(session, days=14)
            market_str = market_data_to_prompt(market)

            prompt = self._build_prompt(previous_outputs, ctx.to_prompt_string(), market_str)

            response = await llm_client.generate(prompt, config=llm_client.STANDARD_CONFIG)

            evaluations = self._parse_evaluations(response.text)

            await self._write_evaluations(session, evaluations, run_date)

            await self._store_judge_output(
                session=session,
                portfolio_id=portfolio_id,
                run_date=run_date,
                summary=response.text,
                evaluations=evaluations,
                response=response,
            )

            logger.info(
                "Judge evaluated %d agent outputs for portfolio %s",
                len(evaluations), portfolio_id,
            )
            return evaluations

    async def _load_unevaluated(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        run_date: date,
    ) -> list[AgentOutput]:
        """Load agent outputs from the previous cycle that haven't been evaluated."""
        cutoff = run_date - timedelta(days=14)
        result = await session.execute(
            select(AgentOutput)
            .where(
                AgentOutput.portfolio_id == portfolio_id,
                AgentOutput.agent_name.in_(EVALUATED_AGENTS),
                AgentOutput.run_date >= cutoff,
                AgentOutput.run_date < run_date,
                AgentOutput.judge_evaluation.is_(None),
                AgentOutput.predictions.isnot(None),
            )
            .order_by(AgentOutput.run_date.desc())
        )
        return list(result.scalars().all())

    def _build_prompt(
        self,
        outputs: list[AgentOutput],
        portfolio_context: str,
        market_summary: str,
    ) -> str:
        parts = [SYSTEM_PROMPT, "", portfolio_context, "", market_summary, ""]

        parts.append("AGENT PREDICTIONS TO EVALUATE:")
        for output in outputs:
            parts.append(f"\n--- Agent: {output.agent_name} (run_date: {output.run_date}, id: {output.id}) ---")
            parts.append(f"Summary excerpt: {output.summary[:800]}")
            if output.predictions:
                parts.append(f"Predictions: {json.dumps(output.predictions, indent=2)}")
            else:
                parts.append("Predictions: None recorded")

        parts.append("\nEvaluate each agent's predictions against what actually happened. Use web search to verify.")
        return "\n".join(parts)

    def _parse_evaluations(self, text: str) -> list[dict]:
        """Extract the JSON evaluations from the judge's response."""
        import re

        for pattern in [r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", r"(\{[\s\S]*\"evaluations\"[\s\S]*\})"]:
            for match in re.finditer(pattern, text):
                try:
                    data = json.loads(match.group(1))
                    if "evaluations" in data and isinstance(data["evaluations"], list):
                        return data["evaluations"]
                except json.JSONDecodeError:
                    continue

        logger.warning("Judge: could not parse structured evaluations from response")
        return []

    async def _write_evaluations(
        self,
        session: AsyncSession,
        evaluations: list[dict],
        run_date: date,
    ) -> None:
        """Write evaluation scores back to the original agent_output rows."""
        for eval_item in evaluations:
            output_id = eval_item.get("agent_output_id")
            overall_score = eval_item.get("overall_score")
            if not output_id:
                continue

            try:
                output_uuid = uuid.UUID(str(output_id))
            except (ValueError, TypeError):
                logger.warning("Judge: invalid output_id '%s', skipping", output_id)
                continue

            await session.execute(
                update(AgentOutput)
                .where(AgentOutput.id == output_uuid)
                .values(
                    judge_evaluation=eval_item,
                    judge_run_date=run_date,
                    judge_overall_score=overall_score,
                )
            )
        await session.commit()

    async def _store_judge_output(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        run_date: date,
        summary: str,
        evaluations: list[dict],
        response: llm_client.LLMResponse,
    ) -> None:
        """Store the judge's own output in agent_outputs."""
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        values = dict(
            portfolio_id=portfolio_id,
            agent_name=self.agent_name,
            run_date=run_date,
            run_type="standard",
            summary=summary,
            structured_data={"evaluations": evaluations},
            predictions=None,
            model_used=response.model_used,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            latency_ms=response.latency_ms,
            sources_cited=response.sources_cited,
        )

        stmt = (
            pg_insert(AgentOutput)
            .values(**values)
            .on_conflict_do_update(
                constraint="agent_outputs_portfolio_id_agent_name_run_date_run_type_key",
                set_={
                    "summary": summary,
                    "structured_data": {"evaluations": evaluations},
                    "model_used": response.model_used,
                    "prompt_tokens": response.prompt_tokens,
                    "completion_tokens": response.completion_tokens,
                    "latency_ms": response.latency_ms,
                    "sources_cited": response.sources_cited,
                },
            )
        )
        await session.execute(stmt)
        await session.commit()
