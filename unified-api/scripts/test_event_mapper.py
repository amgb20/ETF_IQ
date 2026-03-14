"""Manual test: run the EventMapper against existing research outputs."""
import asyncio
import logging
import uuid
from datetime import date

logging.basicConfig(level=logging.INFO)

from app.database import async_session
from sqlalchemy import select, text
from app.models.agent import AgentOutput
from app.agents.event_mapper import EventMapperAgent


async def main():
    async with async_session() as s:
        r = await s.execute(
            select(AgentOutput).where(
                AgentOutput.run_date == date(2026, 3, 13),
                AgentOutput.agent_name.in_(
                    ["ai_stack_analyst", "gold_analyst", "defence_analyst", "macro_analyst"]
                ),
            )
        )
        outputs = list(r.scalars().all())
        print(f"Loaded {len(outputs)} research outputs")

    pid = uuid.UUID("98fb2d7a-151a-493d-9326-d6f9633e9d63")
    mapper = EventMapperAgent()
    try:
        events = await mapper.extract(pid, date(2026, 3, 13), outputs)
        print(f"SUCCESS: {len(events)} events created")
        for e in events:
            print(f"  {e.event_date} | {e.tickers} | {e.sentiment} | imp={e.importance} | {e.headline[:80]}")
    except Exception:
        import traceback
        traceback.print_exc()

    async with async_session() as s:
        r = await s.execute(text("SELECT count(*) FROM chart_events"))
        print(f"Total chart_events now: {r.scalar()}")


asyncio.run(main())
