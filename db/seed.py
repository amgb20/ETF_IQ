"""Seed the 7 portfolio ETFs into the etfs table."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "unified-api"))

from sqlalchemy import text
from app.database import engine

SEED_ETFS = [
    {
        "isin": "IE00BGV5VN51",
        "ticker_yf": "XAIX.L",
        "name": "Xtrackers Artificial Intelligence & Big Data UCITS ETF 1C",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE00BMC38736",
        "ticker_yf": "SMGB.L",
        "name": "iShares MSCI Global Semiconductors UCITS ETF USD (Acc)",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE00BMH5Y327",
        "ticker_yf": "VPNG.L",
        "name": "Global X Data Center REITs & Digital Infrastructure UCITS ETF",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE000NDWFGA5",
        "ticker_yf": "URNG.L",
        "name": "Global X Uranium UCITS ETF USD Accumulating",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE00B3CNHG25",
        "ticker_yf": "AUCP.L",
        "name": "L&G Gold Mining UCITS ETF",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE00B4ND3602",
        "ticker_yf": "SGLN.L",
        "name": "iShares Physical Gold ETC",
        "currency": "USD",
        "exchange": "LSE",
    },
    {
        "isin": "IE000JCW3DZ3",
        "ticker_yf": "ARMG.L",
        "name": "Global X Defence Tech UCITS ETF USD Accumulating",
        "currency": "USD",
        "exchange": "LSE",
    },
]


async def seed():
    async with engine.begin() as conn:
        for etf in SEED_ETFS:
            await conn.execute(
                text(
                    """
                    INSERT INTO etfs (isin, ticker_yf, name, currency, exchange)
                    VALUES (:isin, :ticker_yf, :name, :currency, :exchange)
                    ON CONFLICT (isin) DO NOTHING
                    """
                ),
                etf,
            )
    print(f"Seeded {len(SEED_ETFS)} ETFs.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
