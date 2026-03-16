from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)

EURUSD_TICKER = "EURUSD=X"
TRADING_DAYS_PER_YEAR = 252


class YFinanceConnector(BaseConnector):
    name = "yfinance"

    async def fetch(self, *, tickers: list[str] | None = None, period: str = "5d", interval: str = "1d", **_: Any) -> list[dict]:
        """Download OHLCV data for given tickers via yfinance.

        Returns a list of dicts, one per ticker, each containing the ticker
        string and the raw DataFrame from yf.download.
        """
        if not tickers:
            tickers = await self._default_tickers()

        all_tickers = list(tickers)
        if EURUSD_TICKER not in all_tickers:
            all_tickers.append(EURUSD_TICKER)

        logger.info("yfinance fetch: tickers=%s period=%s interval=%s", all_tickers, period, interval)
        df = yf.download(all_tickers, period=period, interval=interval, group_by="ticker", threads=True)

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
        if not tickers:
            tickers = await self._db_tickers(session)
        logger.info("yfinance ingest: tickers=%s  period=%s", tickers, period)

        raw = await self.fetch(tickers=tickers, period=period)
        rows = await self.normalize(raw)
        if not rows:
            logger.warning("yfinance ingest: no rows to insert (raw had %d items)", len(raw))
            return

        logger.info("yfinance ingest: normalized %d price rows", len(rows))
        ticker_to_etf_id = await self._resolve_etf_ids(session)
        logger.info("yfinance ingest: ticker->etf_id map = %s", ticker_to_etf_id)

        inserted = 0
        skipped = 0
        for row in rows:
            etf_id = ticker_to_etf_id.get(row["ticker"])
            if etf_id is None:
                skipped += 1
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
        logger.info("yfinance ingest: inserted %d price rows, skipped %d (no etf_id match)", inserted, skipped)

    # ------------------------------------------------------------------
    # On-demand intraday fetch (no DB persistence)
    # ------------------------------------------------------------------

    async def fetch_intraday(
        self, *, tickers: list[str], period: str = "1d", interval: str = "5m",
    ) -> list[dict]:
        """Fetch intraday OHLCV data and return normalized rows (not persisted).

        Unlike ``ingest``, this returns data directly for the API to serve.
        Each row contains a full ISO-8601 timestamp rather than a date.
        """
        raw = await self.fetch(tickers=tickers, period=period, interval=interval)
        rows: list[dict] = []
        for item in raw:
            ticker = item["ticker"]
            df_item: pd.DataFrame = item["df"]
            if df_item.empty:
                continue
            for idx, row in df_item.iterrows():
                ts = idx.isoformat() if hasattr(idx, "isoformat") else str(idx)
                rows.append(
                    {
                        "ticker": ticker,
                        "timestamp": ts,
                        "open": _safe_float(row.get("Open")),
                        "high": _safe_float(row.get("High")),
                        "low": _safe_float(row.get("Low")),
                        "close": _safe_float(row.get("Close")),
                        "volume": _safe_int(row.get("Volume")),
                    }
                )
        logger.info("yfinance fetch_intraday: %d rows for %s (%s/%s)", len(rows), tickers, period, interval)
        return rows

    # ------------------------------------------------------------------
    # Metadata enrichment from yf.Ticker.info
    # ------------------------------------------------------------------

    async def enrich_metadata(self, session: AsyncSession) -> int:
        """Fill null ETF fields using yf.Ticker(...).info.

        Only updates columns that are currently NULL in the DB so that
        data already scraped from justETF is preserved.
        Returns the number of ETFs updated.
        """
        result = await session.execute(
            text("SELECT isin, ticker_yf FROM etfs WHERE ticker_yf IS NOT NULL")
        )
        rows = result.all()
        updated = 0

        for isin, ticker_yf in rows:
            try:
                info = yf.Ticker(ticker_yf).info or {}
            except Exception:
                logger.warning("yf.Ticker(%s).info failed", ticker_yf, exc_info=True)
                continue

            sets: list[str] = []
            params: dict[str, Any] = {"isin": isin}

            field_map: dict[str, tuple[str, Any]] = {
                "aum_eur": ("totalAssets", lambda v: int(v) if v else None),
                "description": ("longBusinessSummary", lambda v: v),
                "holdings_count": ("holdings", lambda v: len(v) if isinstance(v, list) else None),
            }

            for col, (info_key, transform) in field_map.items():
                raw = info.get(info_key)
                if raw is not None:
                    val = transform(raw)
                    if val is not None:
                        sets.append(f"{col} = COALESCE({col}, :{col})")
                        params[col] = val

            if not sets:
                continue

            sql = f"UPDATE etfs SET {', '.join(sets)} WHERE isin = :isin"
            await session.execute(text(sql), params)
            updated += 1

        await session.commit()
        logger.info("yfinance enrich_metadata: updated %d ETFs", updated)
        return updated

    # ------------------------------------------------------------------
    # Compute risk fields from stored price data
    # ------------------------------------------------------------------

    async def compute_risk_fields(self, session: AsyncSession) -> int:
        """Calculate vol, return/risk, and max drawdown for 1y/3y/5y/inception
        from the prices table and write them back to the etfs table.
        Returns the number of ETFs updated.
        """
        result = await session.execute(
            text("SELECT id, isin FROM etfs WHERE ticker_yf IS NOT NULL")
        )
        etfs = result.all()
        updated = 0

        for etf_id, isin in etfs:
            prices_result = await session.execute(
                text(
                    "SELECT date, close FROM prices "
                    "WHERE etf_id = :eid ORDER BY date"
                ),
                {"eid": str(etf_id)},
            )
            rows = prices_result.all()
            if len(rows) < 10:
                continue

            dates = [r[0] for r in rows]
            closes = np.array([float(r[1]) for r in rows], dtype=np.float64)
            daily_ret = np.diff(closes) / closes[:-1]
            last_date = dates[-1]

            params: dict[str, Any] = {"isin": isin}
            sets: list[str] = []

            for label, days in [("1y", 200), ("3y", 600), ("5y", 1000)]:
                vol_col = f"vol_{label}"
                rr_col = f"ret_risk_{label}"
                dd_col = f"max_dd_{label}"

                if len(daily_ret) < days:
                    sets.append(f"{vol_col} = NULL")
                    sets.append(f"{rr_col} = NULL")
                    sets.append(f"{dd_col} = NULL")
                    continue

                window_ret = daily_ret[-days:]
                window_closes = closes[-(days + 1):]

                vol = float(np.std(window_ret, ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR))
                ann_ret = float((1 + np.mean(window_ret)) ** TRADING_DAYS_PER_YEAR - 1)
                ret_risk = round(ann_ret / vol, 2) if vol > 0 else None

                cummax = np.maximum.accumulate(window_closes)
                drawdowns = (window_closes - cummax) / cummax
                max_dd = float(np.min(drawdowns))

                sets.append(f"{vol_col} = :v_{label}")
                params[f"v_{label}"] = round(vol * 100, 2)

                sets.append(f"{rr_col} = :rr_{label}")
                params[f"rr_{label}"] = ret_risk

                sets.append(f"{dd_col} = :dd_{label}")
                params[f"dd_{label}"] = round(max_dd * 100, 2)

            # Max drawdown since inception (all data)
            cummax_all = np.maximum.accumulate(closes)
            dd_all = (closes - cummax_all) / cummax_all
            sets.append("max_dd_inception = :dd_inc")
            params["dd_inc"] = round(float(np.min(dd_all)) * 100, 2)

            if sets:
                sql = f"UPDATE etfs SET {', '.join(sets)} WHERE isin = :isin"
                await session.execute(text(sql), params)
                updated += 1

        await session.commit()
        logger.info("yfinance compute_risk_fields: updated %d ETFs", updated)
        return updated

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _db_tickers(self, session: AsyncSession) -> list[str]:
        """Pull all ticker_yf values from the etfs table."""
        result = await session.execute(text("SELECT ticker_yf FROM etfs WHERE ticker_yf IS NOT NULL"))
        tickers = [row[0] for row in result.all()]
        logger.info("yfinance _db_tickers: found %d tickers in DB: %s", len(tickers), tickers)
        if not tickers:
            tickers = ["XAIX.L", "SMGB.L", "VPNG.L", "URNG.L", "AUCP.L", "SGLN.L", "ARMG.L"]
            logger.info("yfinance _db_tickers: using hardcoded fallback tickers")
        return tickers

    async def _default_tickers(self) -> list[str]:
        """Fallback when fetch() is called without a session — hardcoded tickers."""
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
