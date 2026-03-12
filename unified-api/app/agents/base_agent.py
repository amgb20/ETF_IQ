"""Abstract base class for all research agents with memory-reflection loop."""

from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from datetime import date, timedelta

from sqlalchemy import select, desc
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.tools import rag_store
from app.agents.context_builder import (
    PortfolioContext,
    build,
    build_market_summary,
    market_data_to_prompt,
)
from app.agents.prediction_parser import parse as parse_predictions
from app.agents.prompts import get_prompt_version
from app.database import async_session
from app.models.agent import AgentOutput

logger = logging.getLogger(__name__)


async def _embed_output(
    portfolio_id: uuid.UUID,
    output_id: uuid.UUID,
    text: str,
    metadata: dict,
) -> None:
    """Background task: embed an AgentOutput into the RAG store using its own session."""
    async with async_session() as session:
        await rag_store.upsert_chunk(session, portfolio_id, "agent_output", output_id, text, metadata)


REFLECTION_TEMPLATE = """
REFLECTION ON PAST PERFORMANCE:
Your previous analysis (week of {date}):
{summary}

Your predictions from that analysis:
{predictions}

The Judge's evaluation of your predictions:
{judge_eval}

INSTRUCTION: Begin by reflecting on the Judge's evaluation. Acknowledge where
you were wrong. Explain what you missed. Then proceed with this week's analysis.
"""

PREDICTION_INSTRUCTION = """

OUTPUT FORMAT:
After your analysis, you MUST include a PREDICTIONS section with explicit predictions.
Format each prediction as a JSON array:
```json
[
  {{"prediction": "description of what you expect", "confidence": 7, "timeframe": "1 week"}},
  {{"prediction": "another prediction", "confidence": 5, "timeframe": "2 weeks"}}
]
```
Confidence is 1-10 (1 = very uncertain, 10 = very confident).
Timeframe is how long until the prediction can be evaluated.
Include at least 2 and at most 5 predictions.
"""


class BaseAgent(ABC):
    """Template for research agents with memory-reflection support."""

    agent_name: str
    covered_tickers: list[str]

    @abstractmethod
    def build_prompt(
        self,
        context: PortfolioContext,
        market_summary: str,
        past_output: AgentOutput | None,
        judge_eval: dict | None,
    ) -> str:
        """Build the full prompt for this agent."""
        ...

    async def run(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
        run_type: str = "standard",
    ) -> AgentOutput:
        """Execute the full agent cycle: context -> reflect -> generate -> parse -> store."""
        async with async_session() as session:
            ctx = await build(portfolio_id, session)
            market = await build_market_summary(session)
            market_str = market_data_to_prompt(market)

            past_output = await self.load_past_output(session, portfolio_id, run_date)
            judge_eval = None
            if past_output and past_output.judge_evaluation:
                judge_eval = past_output.judge_evaluation

            prompt = self.build_prompt(ctx, market_str, past_output, judge_eval)

            config = (
                llm_client.DEEP_RESEARCH_CONFIG
                if run_type == "deep_research"
                else llm_client.STANDARD_CONFIG
            )
            response = await llm_client.generate(prompt, config=config)

            predictions = parse_predictions(response.text)

            reflection_text = None
            if past_output and judge_eval:
                reflection_text = f"Reflected on Week {past_output.run_date} evaluation."

            output = await self.store_output(
                session=session,
                portfolio_id=portfolio_id,
                run_date=run_date,
                run_type=run_type,
                summary=response.text,
                predictions=predictions,
                reflection=reflection_text,
                research_mode=run_type,
                model_used=response.model_used,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                latency_ms=response.latency_ms,
                sources_cited=response.sources_cited,
            )

            logger.info(
                "Agent %s completed for portfolio %s (run_date=%s, predictions=%d)",
                self.agent_name, portfolio_id, run_date, len(predictions),
            )
            return output

    async def store_output(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        run_date: date,
        run_type: str,
        summary: str,
        predictions: list[dict],
        reflection: str | None = None,
        research_mode: str | None = None,
        model_used: str | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        latency_ms: int | None = None,
        sources_cited: list[dict] | None = None,
    ) -> AgentOutput:
        """Upsert an agent output row."""
        values = dict(
            portfolio_id=portfolio_id,
            agent_name=self.agent_name,
            run_date=run_date,
            run_type=run_type,
            summary=summary,
            structured_data={"predictions": predictions, "prompt_version": get_prompt_version()},
            predictions=predictions,
            reflection=reflection,
            research_mode=research_mode,
            model_used=model_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            sources_cited=sources_cited,
        )

        stmt = (
            pg_insert(AgentOutput)
            .values(**values)
            .on_conflict_do_update(
                constraint="agent_outputs_portfolio_id_agent_name_run_date_run_type_key",
                set_={
                    "summary": summary,
                    "structured_data": {"predictions": predictions, "prompt_version": get_prompt_version()},
                    "predictions": predictions,
                    "reflection": reflection,
                    "research_mode": research_mode,
                    "model_used": model_used,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "latency_ms": latency_ms,
                    "sources_cited": sources_cited,
                },
            )
            .returning(AgentOutput)
        )
        result = await session.execute(stmt)
        await session.commit()
        output = result.scalar_one()

        # Fire-and-forget: embed the output for RAG (uses its own session)
        text = output.summary
        if output.reflection:
            text += f"\n\n{output.reflection}"
        metadata = {
            "agent_name": output.agent_name,
            "run_date": str(output.run_date),
            "judge_overall_score": float(output.judge_overall_score) if getattr(output, "judge_overall_score", None) else None,
            "source_type": "agent_output",
        }
        await _embed_output(output.portfolio_id, output.id, text, metadata)

        return output

    async def load_past_output(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        current_run_date: date,
    ) -> AgentOutput | None:
        """Load the most recent previous output for this agent."""
        result = await session.execute(
            select(AgentOutput)
            .where(
                AgentOutput.portfolio_id == portfolio_id,
                AgentOutput.agent_name == self.agent_name,
                AgentOutput.run_date < current_run_date,
            )
            .order_by(desc(AgentOutput.run_date))
            .limit(1)
        )
        return result.scalar_one_or_none()

    def _build_reflection_block(
        self, past_output: AgentOutput, judge_eval: dict
    ) -> str:
        import json
        preds_str = json.dumps(past_output.predictions, indent=2) if past_output.predictions else "No predictions recorded."
        eval_str = json.dumps(judge_eval, indent=2) if judge_eval else "No evaluation available."
        return REFLECTION_TEMPLATE.format(
            date=past_output.run_date,
            summary=past_output.summary[:1500],
            predictions=preds_str,
            judge_eval=eval_str,
        )
