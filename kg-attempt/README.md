# ETF Knowledge Graph — Exploration

Standalone experiment to model ETF data as a **tuple-based knowledge graph** and
visualise it interactively. No external graph database (Neo4j, Nebula, etc.) — the
graph lives entirely as Python lists of `(source, relation, target, properties)` tuples
plus lightweight `dict`-based node stores.

## Quick start

```bash
cd kg-attempt
.venv\Scripts\activate          # Windows
pip install jupyter ipykernel notebook networkx pyvis yfinance justetf-scraping httpx beautifulsoup4 pandas plotly
python -m ipykernel install --user --name=kg-attempt --display-name "Python (kg-attempt)"
jupyter notebook                # or open in VS Code with the kg-attempt kernel
```

---

## Knowledge Graph Schema

### Node types

Every node is stored as a dict:

```python
{
    "id":    "etf:IE00BGV5VN51",   # unique, prefixed by type
    "type":  "ETF",
    "props": { ... }               # type-specific properties
}
```

| Type | ID pattern | Key properties |
|------|-----------|----------------|
| **ETF** | `etf:<isin>` | `name`, `ticker`, `isin`, `currency`, `ter`, `aum_eur`, `inception_date`, `replication`, `distribution`, `holdings_count`, `vol_1y`, `top10_weight`, `investment_focus` |
| **Provider** | `provider:<name>` | `name` — the fund issuer (e.g. *Xtrackers*, *iShares*, *Global X*, *L&G*) |
| **Holding** | `holding:<isin\|name>` | `name`, `isin` (if known), `ticker` (if known) |
| **Sector** | `sector:<name>` | `name` (e.g. *Technology*, *Financials*) |
| **Country** | `country:<name>` | `name` (e.g. *United States*, *Japan*) |
| **Index** | `index:<name>` | `name` — the benchmark index the ETF tracks |
| **Exchange** | `exchange:<mic>` | `name`, `mic` (e.g. *LSE*) |

### Edge types (relations)

Every edge is a 4-tuple:

```python
(source_id, relation, target_id, properties)
```

| Source → | Relation | → Target | Edge properties |
|----------|----------|----------|-----------------|
| ETF | `ISSUED_BY` | Provider | — |
| ETF | `TRACKS` | Index | — |
| ETF | `LISTED_ON` | Exchange | — |
| ETF | `HOLDS` | Holding | `weight` (0–1 float) |
| ETF | `EXPOSED_TO` | Country | `percentage` (0–100 float, from allocation data) |
| ETF | `INVESTS_IN` | Sector | `percentage` (0–100 float) |
| ETF | `OVERLAPS_WITH` | ETF | `shared_count`, `shared_holdings` (list of holding ids) |

### Visual summary

```
                 ┌──────────┐
                 │ Provider │
                 └────▲─────┘
                      │ ISSUED_BY
┌─────────┐     ┌─────┴─────┐     ┌─────────┐
│  Index   │◄────│    ETF    │────►│Exchange │
└─────────┘     └──┬──┬──┬──┘     └─────────┘
   TRACKS          │  │  │
                   │  │  │ HOLDS (weight)
          ┌────────┘  │  └────────┐
          ▼           │           ▼
     ┌─────────┐      │      ┌─────────┐
     │ Holding │      │      │ Holding │   ← shared holdings
     └─────────┘      │      └─────────┘     create OVERLAPS_WITH
                      │                      between ETFs
          ┌───────────┴───────────┐
          ▼                       ▼
     ┌─────────┐            ┌─────────┐
     │ Country │            │ Sector  │
     └─────────┘            └─────────┘
      EXPOSED_TO             INVESTS_IN
     (percentage)           (percentage)
```

### Example tuples

```python
# Provider relationship
("etf:IE00BGV5VN51", "ISSUED_BY", "provider:Xtrackers", {})

# Holdings with weight
("etf:IE00BGV5VN51", "HOLDS", "holding:US5949181045", {"weight": 0.0892})
("etf:IE00BMC38736", "HOLDS", "holding:US5949181045", {"weight": 0.1245})

# Because both ETFs hold the same stock → overlap edge
("etf:IE00BGV5VN51", "OVERLAPS_WITH", "etf:IE00BMC38736", {
    "shared_count": 3,
    "shared_holdings": ["holding:US5949181045", ...]
})

# Country & sector allocation
("etf:IE00BGV5VN51", "EXPOSED_TO", "country:United States", {"percentage": 72.5})
("etf:IE00BGV5VN51", "INVESTS_IN", "sector:Technology",     {"percentage": 85.3})
```

---

## Data sources

| Source | What we get | Method |
|--------|------------|--------|
| `justetf-scraping` | ETF overview (TER, AUM, holdings, countries, sectors) | `get_etf_overview(isin)` |
| justETF profile HTML | Provider, index, legal structure, investment focus, top-10 holdings, country/sector allocations | HTTP scrape with `httpx` |
| Yahoo Finance (`yfinance`) | Live price, market cap, volume, historical OHLCV | `yfinance.Ticker(ticker)` |

The 7 seed ETFs:

| Ticker | ISIN | Name |
|--------|------|------|
| XAIX.L | IE00BGV5VN51 | Xtrackers AI & Big Data UCITS ETF |
| SMGB.L | IE00BMC38736 | iShares MSCI Global Semiconductors UCITS ETF |
| VPNG.L | IE00BMH5Y327 | Global X Data Center REITs & Digital Infra UCITS ETF |
| URNG.L | IE000NDWFGA5 | Global X Uranium UCITS ETF |
| AUCP.L | IE00B3CNHG25 | L&G Gold Mining UCITS ETF |
| SGLN.L | IE00B4ND3602 | iShares Physical Gold ETC |
| ARMG.L | IE000JCW3DZ3 | Global X Defence Tech UCITS ETF |

---

## Files

| File | Purpose |
|------|---------|
| `etf_kg_explore.ipynb` | Notebook: scrape → build tuples → visualise |
| `README.md` | This file |
| `.venv/` | Python 3.12 virtual environment |

---

## Design decisions

- **No graph DB** — tuples are plain Python lists; `networkx` is used only for
  layout & analysis, not storage.
- **Isolated from main app** — nothing in this folder is imported by the main
  ETF_IQ codebase. Once the approach is validated it can be ported.
- **Interactive vis** — `pyvis` renders a self-contained HTML file that can be
  opened in any browser. Nodes are coloured by type, edges by relation, and the
  physics engine makes clusters emerge naturally.
