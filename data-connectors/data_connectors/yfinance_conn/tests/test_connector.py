"""Unit tests for YFinanceConnector — normalize and fetch logic."""

from datetime import date
from unittest.mock import AsyncMock, patch, MagicMock

import pandas as pd
import pytest

from data_connectors.yfinance_conn.connector import YFinanceConnector


@pytest.fixture
def connector():
    return YFinanceConnector()


def _make_df(rows: list[dict], index_dates: list[str]) -> pd.DataFrame:
    idx = pd.DatetimeIndex([pd.Timestamp(d) for d in index_dates])
    return pd.DataFrame(rows, index=idx)


@pytest.mark.asyncio
async def test_normalize_maps_columns(connector):
    df = _make_df(
        [{"Open": 10.0, "High": 12.0, "Low": 9.5, "Close": 11.0, "Volume": 1000}],
        ["2026-03-05"],
    )
    raw = [{"ticker": "SMGB.L", "df": df}]
    rows = await connector.normalize(raw)

    assert len(rows) == 1
    row = rows[0]
    assert row["ticker"] == "SMGB.L"
    assert row["date"] == date(2026, 3, 5)
    assert row["open"] == 10.0
    assert row["high"] == 12.0
    assert row["low"] == 9.5
    assert row["close"] == 11.0
    assert row["volume"] == 1000


@pytest.mark.asyncio
async def test_normalize_handles_nan(connector):
    df = _make_df(
        [{"Open": float("nan"), "High": None, "Low": 9.0, "Close": 10.0, "Volume": float("nan")}],
        ["2026-03-06"],
    )
    raw = [{"ticker": "XAIX.L", "df": df}]
    rows = await connector.normalize(raw)

    assert rows[0]["open"] is None
    assert rows[0]["high"] is None
    assert rows[0]["volume"] is None
    assert rows[0]["close"] == 10.0


@pytest.mark.asyncio
async def test_normalize_empty_df(connector):
    raw = [{"ticker": "XAIX.L", "df": pd.DataFrame()}]
    rows = await connector.normalize(raw)
    assert rows == []


@pytest.mark.asyncio
async def test_normalize_multiple_tickers(connector):
    df1 = _make_df(
        [{"Open": 1, "High": 2, "Low": 0.5, "Close": 1.5, "Volume": 100}],
        ["2026-03-05"],
    )
    df2 = _make_df(
        [{"Open": 50, "High": 55, "Low": 48, "Close": 52, "Volume": 9999}],
        ["2026-03-05"],
    )
    raw = [{"ticker": "A.L", "df": df1}, {"ticker": "B.L", "df": df2}]
    rows = await connector.normalize(raw)
    assert len(rows) == 2
    assert {r["ticker"] for r in rows} == {"A.L", "B.L"}
