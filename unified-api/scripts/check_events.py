"""Quick diagnostic: check chart_events and event_mapper outputs."""

import asyncio

from sqlalchemy import text

from app.database import async_session


async def main():
    async with async_session() as s:
        r = await s.execute(text("SELECT count(*) FROM chart_events"))
        print(f"Total chart_events: {r.scalar()}")

        r = await s.execute(
            text(
                "SELECT id, event_date, headline, tickers, sentiment, importance, source_agent "
                "FROM chart_events ORDER BY event_date DESC LIMIT 10"
            )
        )
        rows = r.fetchall()
        if rows:
            for row in rows:
                print(f"  {row[1]} | {row[3]} | {row[4]} | imp={row[5]} | {row[2][:80]}")
        else:
            print("  (no events found)")

        r = await s.execute(
            text(
                "SELECT agent_name, run_date, run_type "
                "FROM agent_outputs WHERE agent_name = 'event_mapper' "
                "ORDER BY run_date DESC LIMIT 5"
            )
        )
        rows = r.fetchall()
        print(f"\nEvent mapper outputs: {len(rows)}")
        for row in rows:
            print(f"  {row[0]} | {row[1]} | {row[2]}")

        r = await s.execute(text("SELECT agent_name, run_date FROM agent_outputs ORDER BY run_date DESC LIMIT 15"))
        rows = r.fetchall()
        print("\nAll recent agent_outputs:")
        for row in rows:
            print(f"  {row[0]} | {row[1]}")


asyncio.run(main())
