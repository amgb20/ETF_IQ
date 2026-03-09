from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

import pandas as pd
import yfinance as yf
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)

EURUSD_TICKER = "EURUSD=X"


class YFinanceConnector(BaseConnector):
    name = "yfinance"

    async def fetch(self, *, tickers: list[str] | None = None, period: str = "5d", **_: Any) -> list[dict]:
        """Download OHLCV data for given tickers via yfinance.

        Returns a list of dicts, one per ticker, each containing the ticker
        string and the raw DataFrame from yf.download.
        """
        if not tickers:
            tickers = await self._default_tickers()

        all_tickers = list(tickers)
        if EURUSD_TICKER not in all_tickers:
            all_tickers.append(EURUSD_TICKER)

        logger.info("yfinance fetch: tickers=%s period=%s", all_tickers, period)
        df = yf.download(all_tickers, period=period, group_by="ticker", threads=True)

        results: list[dict] = []
        if len(all_tickers) == 1:
            results.append({"ticker": all_tickers[0], "df": df})
        else:
            for ticker in all_tickers:
                try:
                    ticker_df = df[ticker].dropna(how="all")
                    results.append({"ticker": ticker, "df": ticker_df})
                except KeyError:
                    logger.warning("No data returned for %s", ticker)
        return results

    async def normalize(self, raw: list[dict]) -> list[dict]:
        """Map yfinance DataFrames to prices-table rows.

        Each returned dict has keys: ticker, date, open, high, low, close, volume.
        The etf_id resolution happens at ingest time.
        """
        rows: list[dict] = []
        for item in raw:
            ticker = item["ticker"]
            df: pd.DataFrame = item["df"]
            if df.empty:
                continue
            for idx, row in df.iterrows():
                dt = idx.date() if isinstance(idx, (datetime, pd.Timestamp)) else idx
                rows.append(
                    {
                        "ticker": ticker,
                        "date": dt,
                        "open": _safe_float(row.get("Open")),
                        "high": _safe_float(row.get("High")),
                        "low": _safe_float(row.get("Low")),
                        "close": _safe_float(row.get("Close")),
                        "volume": _safe_int(row.get("Volume")),
                    }
                )
        return rows

    async def ingest(self, session: AsyncSession, *, tickers: list[str] | None = None, period: str = "5d", **_: Any) -> None:
        raw = await self.fetch(tickers=tickers, period=period)
        rows = await self.normalize(raw)
        if not rows:
            logger.warning("yfinance ingest: no rows to insert")
            return

        ticker_to_etf_id = await self._resolve_etf_ids(session)

        inserted = 0
        for row in rows:
            etf_id = ticker_to_etf_id.get(row["ticker"])
            if etf_id is None:
                continue
            result = await session.execute(
                text(
                    """
                    INSERT INTO prices (etf_id, date, open, high, low, close, volume)
                    VALUES (:etf_id, :date, :open, :high, :low, :close, :volume)
                    ON CONFLICT (etf_id, date) DO NOTHING
                    """
                ),
                {
                    "etf_id": etf_id,
                    "date": row["date"],
                    "open": row["open"],
                    "high": row["high"],
                    "low": row["low"],
                    "close": row["close"],
                    "volume": row["volume"],
                },
            )
            inserted += result.rowcount
        await session.commit()
        logger.info("yfinance ingest: inserted %d price rows", inserted)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _default_tickers(self) -> list[str]:
        """Fallback ticker list when none provided — reads from etfs table would
        require a session, so we hard-code the portfolio tickers here."""
        return [
            "XAIX.L", "SMGB.L", "VPNG.L", "URNG.L",
            "AUCP.L", "SGLN.L", "ARMG.L",
        ]

    @staticmethod
    async def _resolve_etf_ids(session: AsyncSession) -> dict[str, str]:
        """Build a ticker_yf -> etf_id mapping from the etfs table."""
        result = await session.execute(text("SELECT id, ticker_yf FROM etfs WHERE ticker_yf IS NOT NULL"))
        return {row.ticker_yf: str(row.id) for row in result}


def _safe_float(val: Any) -> float | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return float(val)


def _safe_int(val: Any) -> int | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return int(val)
