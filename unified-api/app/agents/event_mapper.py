"""Agent 6 — News-to-Timeline Mapper.

Extracts structured ChartEvent objects from research agent outputs and stores
them in the chart_events table.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import date

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.prompts.v1.agent6_events import SYSTEM_PROMPT
from app.database import async_session
from app.models.agent import AgentOutput, ChartEvent

logger = logging.getLogger(__name__)


class EventMapperAgent:
    agent_name = "event_mapper"

    async def extract(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
        research_outputs: list[AgentOutput],
    ) -> list[ChartEvent]:
        """Extract timeline events from research outputs and store them."""
        async with async_session() as session:
            summaries = []
            output_map: dict[str, AgentOutput] = {}
            for o in research_outputs:
                summaries.append(f"--- {o.agent_name} (run_date: {o.run_date}) ---\n{o.summary[:2000]}")
                output_map[o.agent_name] = o

            prompt = self._build_prompt("\n\n".join(summaries))
            response = await llm_client.generate(prompt, config=llm_client.STANDARD_CONFIG)
            raw_events = self._parse_events(response.text)

            chart_events: list[ChartEvent] = []
            for ev in raw_events:
                agent_output_id = None
                src_agent = ev.get("source_agent")
                if src_agent and src_agent in output_map:
                    agent_output_id = output_map[src_agent].id

                try:
                    event_date = date.fromisoformat(ev["event_date"])
                except (ValueError, KeyError):
                    event_date = run_date

                tickers = ev.get("tickers", [])
                if not tickers or not isinstance(tickers, list):
                    continue

                chart_event = ChartEvent(
                    portfolio_id=portfolio_id,
                    agent_output_id=agent_output_id,
                    event_date=event_date,
                    headline=ev.get("headline", "Unknown event")[:200],
                    description=ev.get("description"),
                    source_url=ev.get("source_url"),
                    tickers=tickers,
                    themes=ev.get("themes"),
                    sentiment=ev.get("sentiment", "neutral"),
                    importance=min(max(ev.get("importance", 3), 1), 5),
                    source_agent=src_agent,
                )
                session.add(chart_event)
                chart_events.append(chart_event)

            await self._store_agent_output(session, portfolio_id, run_date, response, raw_events)
            await session.commit()

            logger.info("EventMapper extracted %d events for portfolio %s", len(chart_events), portfolio_id)
            return chart_events

    def _build_prompt(self, concatenated_summaries: str) -> str:
        return f"{SYSTEM_PROMPT}\n\nRESEARCH AGENT SUMMARIES:\n{concatenated_summaries}"

    def _parse_events(self, text: str) -> list[dict]:
        for pattern in [r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", r"(\[[\s\S]*?\])"]:
            for match in re.finditer(pattern, text):
                try:
                    data = json.loads(match.group(1))
                    if isinstance(data, list) and len(data) > 0:
                        return data
                except json.JSONDecodeError:
                    continue
        logger.warning("EventMapper: could not parse events from LLM response")
        return []

    async def _store_agent_output(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        run_date: date,
        response: llm_client.LLMResponse,
        events: list[dict],
    ) -> None:
        values = dict(
            portfolio_id=portfolio_id,
            agent_name=self.agent_name,
            run_date=run_date,
            run_type="standard",
            summary=response.text,
            structured_data={"events": events},
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
                    "summary": response.text,
                    "structured_data": {"events": events},
                    "model_used": response.model_used,
                    "prompt_tokens": response.prompt_tokens,
                    "completion_tokens": response.completion_tokens,
                    "latency_ms": response.latency_ms,
                    "sources_cited": response.sources_cited,
                },
            )
        )
        await session.execute(stmt)
