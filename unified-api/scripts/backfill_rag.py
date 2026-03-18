"""Backfill all existing agent_outputs and chart_events into rag_chunks.

Run from unified-api/:
    python -m scripts.backfill_rag
"""

import asyncio
import os
import sys

# Allow running from the unified-api directory
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select

from app.agents.tools import rag_store
from app.database import async_session
from app.models.agent import AgentOutput, ChartEvent
from app.models.rag import RagChunk


async def backfill() -> None:
    async with async_session() as session:
        # Load already-embedded source IDs to skip them
        existing = set((await session.execute(select(RagChunk.source_id, RagChunk.source_type))).all())
        existing_ids = {(str(src_id), src_type) for src_id, src_type in existing}

        outputs = (await session.execute(select(AgentOutput))).scalars().all()
        to_embed = [o for o in outputs if (str(o.id), "agent_output") not in existing_ids]
        print(f"AgentOutputs: {len(outputs)} total, {len(to_embed)} need embedding")
        for o in to_embed:
            text = o.summary + (f"\n\n{o.reflection}" if o.reflection else "")
            metadata = {
                "agent_name": o.agent_name,
                "run_date": str(o.run_date),
                "judge_overall_score": float(o.judge_overall_score)
                if getattr(o, "judge_overall_score", None)
                else None,
                "source_type": "agent_output",
            }
            await rag_store.upsert_chunk(session, o.portfolio_id, "agent_output", o.id, text, metadata)
            print(f"  Embedded agent_output {o.id} ({o.agent_name} {o.run_date})")

        events = (await session.execute(select(ChartEvent))).scalars().all()
        to_embed_events = [e for e in events if (str(e.id), "chart_event") not in existing_ids]
        print(f"ChartEvents: {len(events)} total, {len(to_embed_events)} need embedding")
        for e in to_embed_events:
            text = e.headline + (f"\n{e.description}" if e.description else "")
            metadata = {
                "event_date": str(e.event_date),
                "tickers": e.tickers,
                "sentiment": e.sentiment,
                "importance": e.importance,
                "source_type": "chart_event",
            }
            await rag_store.upsert_chunk(session, e.portfolio_id, "chart_event", e.id, text, metadata)
            print(f"  Embedded chart_event {e.id} ({e.headline[:60]})")

    print("\nBackfill complete.")


if __name__ == "__main__":
    asyncio.run(backfill())
