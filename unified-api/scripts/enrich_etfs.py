"""One-shot: enrich ETF metadata from yfinance and compute risk fields from prices."""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logging.basicConfig(level=logging.INFO)

from data_connectors.yfinance_conn.connector import YFinanceConnector

from app.database import async_session, engine


async def main():
    conn = YFinanceConnector()
    async with async_session() as session:
        print("Enriching ETF metadata from yfinance...")
        meta = await conn.enrich_metadata(session)
        print(f"  -> {meta} ETFs updated with metadata")

        print("Computing risk fields from price history...")
        risk = await conn.compute_risk_fields(session)
        print(f"  -> {risk} ETFs updated with risk fields")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
