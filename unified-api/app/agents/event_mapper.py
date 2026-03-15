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
from app.agents.tools import rag_store
from app.database import async_session
from app.models.agent import AgentOutput, ChartEvent

logger = logging.getLogger(__name__)


async def _embed_event(
    portfolio_id: uuid.UUID,
    event_id: uuid.UUID,
    text: str,
    metadata: dict,
) -> None:
    """Background task: embed a ChartEvent into the RAG store using its own session."""
    async with async_session() as session:
        await rag_store.upsert_chunk(session, portfolio_id, "chart_event", event_id, text, metadata)


class EventMapperAgent:
    agent_name = "event_mapper"

    async def extract(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
        research_outputs: list[AgentOutput],
    ) -> list[ChartEvent]:
        """Extract timeline events from research outputs and store them."""
        import time as _time

        t0 = _time.perf_counter()
        logger.info(
            "EventMapper starting for portfolio %s (run_date=%s, research_outputs=%d)",
            portfolio_id, run_date, len(research_outputs),
        )

        summaries: list[str] = []
        output_ids: dict[str, uuid.UUID] = {}
        for o in research_outputs:
            try:
                name = o.agent_name
                rd = o.run_date
                summary = o.summary[:2000]
                oid = o.id
                block = f"--- {name} (run_date: {rd}) ---\n{summary}"
                if o.sources_cited:
                    block += "\nSOURCES CITED:\n" + self._format_sources(o.sources_cited)
                summaries.append(block)
                output_ids[name] = oid
            except Exception:
                logger.exception("EventMapper: failed to read research output attrs")

        if not summaries:
            logger.warning("EventMapper: no summaries extracted, skipping")
            return []

        prompt = self._build_prompt("\n\n".join(summaries))

        response: llm_client.LLMResponse | None = None
        raw_events: list[dict] = []
        llm_error: str | None = None

        try:
            logger.info("EventMapper: calling LLM...")
            response = await llm_client.generate(
                prompt, config=llm_client.STRUCTURED_OUTPUT_CONFIG,
            )
            raw_events = self._parse_events(response.text)
            logger.info("EventMapper: LLM returned %d parsed events", len(raw_events))
        except Exception as exc:
            logger.exception("EventMapper: LLM call failed: %s", exc)
            llm_error = str(exc)

        # Backfill source_url from agent's sources_cited when LLM omitted it
        sources_by_agent: dict[str, list] = {}
        for o in research_outputs:
            try:
                if o.sources_cited:
                    items = o.sources_cited if isinstance(o.sources_cited, list) else [o.sources_cited]
                    sources_by_agent[o.agent_name] = items
            except Exception:
                pass

        for ev in raw_events:
            if not isinstance(ev, dict):
                continue
            if not ev.get("source_url") and ev.get("source_agent"):
                agent_sources = sources_by_agent.get(ev["source_agent"], [])
                for item in agent_sources:
                    if isinstance(item, dict):
                        url = item.get("url") or item.get("uri") or item.get("link")
                        if url:
                            ev["source_url"] = url
                            break

        chart_events: list[ChartEvent] = []

        async with async_session() as session:
            for ev in raw_events:
                if not isinstance(ev, dict):
                    continue

                agent_output_id = None
                src_agent = ev.get("source_agent")
                if src_agent and src_agent in output_ids:
                    agent_output_id = output_ids[src_agent]

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

            if response:
                await self._store_agent_output(
                    session, portfolio_id, run_date, response, raw_events,
                )
            elif llm_error:
                await self._store_error_output(
                    session, portfolio_id, run_date, llm_error,
                )

            await session.commit()

        for event in chart_events:
            try:
                text = event.headline
                if event.description:
                    text += f"\n{event.description}"
                await _embed_event(
                    portfolio_id=event.portfolio_id,
                    event_id=event.id,
                    text=text,
                    metadata={
                        "event_date": str(event.event_date),
                        "tickers": event.tickers,
                        "sentiment": event.sentiment,
                        "importance": event.importance,
                        "source_type": "chart_event",
                    },
                )
            except Exception:
                logger.exception("EventMapper: failed to embed event %s", event.id)

        elapsed_ms = int((_time.perf_counter() - t0) * 1000)
        logger.info(
            "EventMapper completed: extracted %d events for portfolio %s (elapsed=%dms)",
            len(chart_events), portfolio_id, elapsed_ms,
        )
        return chart_events

    @staticmethod
    def _format_sources(sources_cited: dict | list | None) -> str:
        """Flatten sources_cited (JSONB) into a readable list of URLs for the prompt."""
        if not sources_cited:
            return ""
        lines: list[str] = []
        items = sources_cited if isinstance(sources_cited, list) else [sources_cited]
        for item in items:
            if isinstance(item, dict):
                url = item.get("url") or item.get("uri") or item.get("link", "")
                title = item.get("title", "")
                if url:
                    lines.append(f"  - {title}: {url}" if title else f"  - {url}")
            elif isinstance(item, str):
                lines.append(f"  - {item}")
        return "\n".join(lines) if lines else json.dumps(sources_cited)[:500]

    def _build_prompt(self, concatenated_summaries: str) -> str:
        return f"{SYSTEM_PROMPT}\n\nRESEARCH AGENT SUMMARIES:\n{concatenated_summaries}"

    def _parse_events(self, text: str) -> list[dict]:
        patterns = [
            r"```(?:json)?\s*(\[[\s\S]*?\])\s*```",
            r"(\[[\s\S]*\])",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                try:
                    data = json.loads(match.group(1))
                except json.JSONDecodeError:
                    continue
                if not isinstance(data, list) or len(data) == 0:
                    continue
                events = [item for item in data if isinstance(item, dict)]
                if events:
                    return events

        # Fallback: the JSON array may be truncated (model hit token limit).
        # Try to recover complete objects before the truncation point.
        recovered = self._recover_truncated_events(text)
        if recovered:
            logger.warning(
                "EventMapper: recovered %d events from truncated JSON", len(recovered),
            )
            return recovered

        logger.warning("EventMapper: could not parse events from LLM response")
        return []

    @staticmethod
    def _recover_truncated_events(text: str) -> list[dict]:
        """Extract individual {...} event objects even if the surrounding array is broken."""
        results: list[dict] = []
        depth = 0
        start = -1
        for i, ch in enumerate(text):
            if ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start >= 0:
                    try:
                        obj = json.loads(text[start : i + 1])
                        if isinstance(obj, dict) and "headline" in obj:
                            results.append(obj)
                    except json.JSONDecodeError:
                        pass
                    start = -1
        return results

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

    async def _store_error_output(
        self,
        session: AsyncSession,
        portfolio_id: uuid.UUID,
        run_date: date,
        error_msg: str,
    ) -> None:
        """Store a minimal agent_output recording the failure."""
        values = dict(
            portfolio_id=portfolio_id,
            agent_name=self.agent_name,
            run_date=run_date,
            run_type="standard",
            summary=f"EventMapper failed: {error_msg}",
            structured_data={"error": error_msg, "events": []},
            predictions=None,
        )
        stmt = (
            pg_insert(AgentOutput)
            .values(**values)
            .on_conflict_do_update(
                constraint="agent_outputs_portfolio_id_agent_name_run_date_run_type_key",
                set_={
                    "summary": f"EventMapper failed: {error_msg}",
                    "structured_data": {"error": error_msg, "events": []},
                },
            )
        )
        await session.execute(stmt)
