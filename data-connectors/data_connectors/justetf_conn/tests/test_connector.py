"""Unit tests for JustETFConnector normalization logic."""

import pytest

from data_connectors.justetf_conn.connector import JustETFConnector


@pytest.fixture
def connector():
    return JustETFConnector()


SAMPLE_OVERVIEW = {
    "ter": 0.0035,
    "fund_size_eur": 500_000_000,
    "description": "Tracks semiconductors worldwide",
    "domicile": "Ireland",
    "replication": "Physical",
    "distribution_policy": "Accumulating",
    "number_of_holdings": 30,
    "inception_date": "2021-09-07",
    "top_holdings": [
        {"name": "TSMC", "isin": "TW0002330008", "ticker": "2330.TW", "weight": 0.12},
        {"name": "NVIDIA", "isin": "US67066G1040", "ticker": "NVDA", "weight": 0.10},
    ],
    "countries": [
        {"name": "United States", "share": 55.2},
        {"name": "Taiwan", "share": 18.3},
    ],
    "sectors": [
        {"name": "Technology", "share": 92.1},
        {"name": "Industrials", "share": 4.5},
    ],
}


@pytest.mark.asyncio
async def test_normalize_overview_fields(connector):
    raw = [{"isin": "IE00BMC38736", "overview": SAMPLE_OVERVIEW, "chart": None}]
    rows = await connector.normalize(raw)
    etf_rows = [r for r in rows if r["type"] == "etf_update"]
    assert len(etf_rows) == 1
    etf = etf_rows[0]
    assert etf["isin"] == "IE00BMC38736"
    assert etf["ter"] == 0.0035
    assert etf["aum_eur"] == 500_000_000
    assert etf["domicile"] == "Ireland"


@pytest.mark.asyncio
async def test_normalize_holdings(connector):
    raw = [{"isin": "IE00BMC38736", "overview": SAMPLE_OVERVIEW, "chart": None}]
    rows = await connector.normalize(raw)
    holdings = [r for r in rows if r["type"] == "holding"]
    assert len(holdings) == 2
    assert holdings[0]["holding_name"] == "TSMC"
    assert holdings[0]["holding_isin"] == "TW0002330008"
    assert holdings[1]["weight"] == 0.10


@pytest.mark.asyncio
async def test_normalize_allocations(connector):
    raw = [{"isin": "IE00BMC38736", "overview": SAMPLE_OVERVIEW, "chart": None}]
    rows = await connector.normalize(raw)
    allocs = [r for r in rows if r["type"] == "allocation"]
    countries = [a for a in allocs if a["allocation_type"] == "country"]
    sectors = [a for a in allocs if a["allocation_type"] == "sector"]
    assert len(countries) == 2
    assert len(sectors) == 2
    assert countries[0]["name"] == "United States"
    assert countries[0]["percentage"] == 55.2


@pytest.mark.asyncio
async def test_normalize_missing_overview_keys(connector):
    raw = [{"isin": "IE00BGV5VN51", "overview": {}, "chart": None}]
    rows = await connector.normalize(raw)
    assert len(rows) == 1
    etf = rows[0]
    assert etf["ter"] is None
    assert etf["aum_eur"] is None


@pytest.mark.asyncio
async def test_normalize_empty_holdings(connector):
    overview = {**SAMPLE_OVERVIEW, "top_holdings": []}
    raw = [{"isin": "IE00BGV5VN51", "overview": overview, "chart": None}]
    rows = await connector.normalize(raw)
    holdings = [r for r in rows if r["type"] == "holding"]
    assert holdings == []
