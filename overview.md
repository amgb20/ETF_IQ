# PortfolioIQ — Architecture v3 (Final Pre-Build Specification)

---

## Decisions Locked In (Updated)

| Decision | v2 | v3 (Updated) |
|----------|----|----|
| LLM | Gemini only | **gemini-3-pro-preview** for all agents. Deep research with 10min cap for reports. |
| Market data | yfinance + FMP + scraping | **yfinance (primary) + justetf-scraping library (structural data). No FMP.** |
| Agents | 8 agents | 8 research/functional agents + **1 conversational chatbot agent (Agent 9)** |
| Memory | Weekly persistent | **Weekly persistent + LLM-as-Judge reflection loop + cumulative sentiment tracking** |
| Reports | Generated on demand | Generated with **deep research mode (10min thinking cap)** |
| Frontend | 5 tabs | **3 pages: Dashboard, Analysis, Reports** |
| Chatbot | Not planned | **Conversational agent with portfolio context + web search + report history tools** |
| Prompt management | Hardcoded | **Versioned in code now; future: external agent builder platform with API tokens** |

---

## Part 1: Data Layer — yfinance + justetf-scraping

### Verdict: Drop FMP Entirely

FMP's free tier (250 calls/day) is too fragile for a production app and adds a dependency you don't need. Between yfinance and the `justetf-scraping` library, you get everything:

| Data needed | Source | Method |
|-------------|--------|--------|
| Daily OHLCV prices | **yfinance** | `yf.download("SMGB.L", period="1y")` |
| Historical chart (with dividends) | **justetf-scraping** | `justetf_scraping.load_chart("IE00BMC38736")` |
| TER, AUM, fund size, description | **justetf-scraping** | `justetf_scraping.get_etf_overview("IE00BMC38736")` |
| Top 10 holdings with ISINs | **justetf-scraping** | `overview['top_holdings']` |
| Country allocation | **justetf-scraping** | `overview['countries']` |
| Sector allocation | **justetf-scraping** | `overview['sectors']` |
| Live Gettex quote (bid/ask) | **justetf-scraping** | `overview['gettex']` |
| Multi-ETF comparison chart | **justetf-scraping** | `justetf_scraping.compare_charts({...})` |
| EUR/USD exchange rate | **yfinance** | `yf.download("EURUSD=X")` |
| Overlap detection (shared holdings) | **Computed** | Cross-reference `top_holdings` across ETFs in portfolio |

### The justetf-scraping Library — What It Does

```python
import justetf_scraping

# Full ETF profile — the justETF-equivalent data
overview = justetf_scraping.get_etf_overview("IE00BMC38736")
# Returns: name, ter, fund_size_eur, description,
#          countries[], sectors[], top_holdings[] (with ISINs),
#          gettex quote (bid, ask, day_change)

# Full price history with dividends
chart = justetf_scraping.load_chart("IE00BMC38736")
# Returns: DataFrame with date, close, high, low, dividends

# Compare multiple ETFs (rebased to percentage gain)
comparison = justetf_scraping.compare_charts({
    "IE00BMC38736": justetf_scraping.load_chart("IE00BMC38736"),  # SMGB
    "IE00BGV5VN51": justetf_scraping.load_chart("IE00BGV5VN51"),  # XAIX
})
# Returns: DataFrame with aligned percentage returns
```

This library is MIT-licensed, uses justETF's internal API endpoints (not HTML scraping — more stable), and outputs pandas DataFrames directly. It replaces FMP, eliminates HTML scraping fragility, and gives you the exact data justETF displays.

### Your Repo (theperu/justETF-complete-ETF-scraper) — Assessment

It uses justETF's Wicket AJAX endpoints to bulk-fetch ETF lists, then scrapes individual profile pages. Useful if you need to discover ETFs (search/filter across 3400+ ETFs). **Less useful** for our case because we already know our 7 ISINs. The `druzsan/justetf-scraping` library is better for per-ISIN data retrieval. However, the theperu scraper becomes valuable later for a SaaS "ETF search" feature where users browse and add new ETFs to their portfolio.

**Decision: Use `druzsan/justetf-scraping` as primary structural data source. Keep theperu scraper bookmarked for Phase 6 (SaaS ETF discovery feature).**

### Data Refresh Architecture (Revised)

```
Daily 06:00 UTC (cron)
│
├── yfinance batch pull (all portfolio ETFs)
│   └── Fetch last 5 trading days OHLCV
│   └── Append to prices table
│   └── Calculate: daily return, cumulative return from entry
│
├── Alert evaluation
│   └── Check all active thresholds against latest prices
│   └── Fire alerts, store events, notify user
│
└── Portfolio snapshot
    └── Calculate: total value, P&L, allocation drift
    └── Store in portfolio_snapshots table (one row per day)

Weekly Sunday 22:00 UTC (cron)
│
├── justetf-scraping full refresh
│   └── For each ETF: get_etf_overview(isin)
│   └── Update: TER, AUM, holdings, sectors, countries
│   └── Run overlap analysis across portfolio
│
├── justetf-scraping chart comparison
│   └── compare_charts() for all portfolio ETFs
│   └── Store rebased comparison data for frontend
│
└── Trigger Monday morning agent cycle (next section)

Monday 08:00 UTC (cron)
│
└── Full weekly agent cycle (Part 2)
```

---

## Part 2: Agent Architecture — The Memory-Reflection Loop (Confirmed)

### Confirming Your Understanding — The Weekly Loop

You asked to confirm the flow. Here's the exact sequence, step by step:

```
WEEK 1 (Monday 08:00):

  Step 1: Research agents (1-4) run IN PARALLEL
    Each agent:
    → Receives: portfolio state, market data, its system prompt
    → Searches the web (Gemini Google Search grounding)
    → Uses internal knowledge
    → Produces: analysis + explicit predictions with confidence (1-10)
    → Stores output in agent_outputs table

  Step 2: News-to-Timeline Mapper (Agent 6) runs
    → Reads all outputs from step 1
    → Extracts dated events → stores in chart_events table

  Step 3: Action Recommender (Agent 7) runs
    → Reads all research outputs
    → Produces: recommended actions with reasoning + disclaimers
    → Stores output with its own predictions

  Step 4: Done. User receives email digest.

────────────── ONE WEEK PASSES ──────────────

WEEK 2 (Monday 08:00):

  Step 0: JUDGE RUNS FIRST (Agent 8)
    → Loads: all predictions from Week 1 (agents 1-4 + agent 7)
    → Loads: actual market data for the past week (prices, news)
    → Searches the web to verify what actually happened
    → For EACH prediction from Week 1:
        - Was it correct, partially correct, or wrong?
        - Was the confidence level calibrated? (high confidence + wrong = bad)
        - Were the cited reasons the actual drivers?
        - Score: 1-10 per prediction
        - Overall agent accuracy score
    → Stores evaluation in judge_evaluation column of Week 1's agent_outputs

  Step 1: Research agents (1-4) run IN PARALLEL
    Each agent now receives ADDITIONAL context:
    → Its OWN output from Week 1 (what it said)
    → The Judge's evaluation of its Week 1 predictions (what the Judge thought)
    → INSTRUCTION: "Begin by reflecting on the Judge's evaluation.
       Acknowledge where you were wrong. Explain what you missed.
       Then proceed with this week's analysis."
    → Produces: reflection + new analysis + new predictions

  Steps 2-4: Same as Week 1.

────────────── PATTERN REPEATS EVERY WEEK ──────────────
```

**The key mechanism**: Each agent is forced to confront its own track record before producing new analysis. An agent that was confidently wrong last week must acknowledge the miss, which naturally calibrates its confidence over time. The Judge is the enforcement mechanism — without it, agents would simply ignore their past errors.

### The Full Agent Roster (9 Agents)

```
RESEARCH AGENTS (4)
│
├── Agent 1: AI Stack Analyst
│   Coverage: XAIX, SMGB, VPNG, URNG
│   Focus: AI capex, semiconductor supply, data center capacity, nuclear energy
│   Web searches: earnings reports, capex announcements, chip supply chain
│
├── Agent 2: Gold & Precious Metals Analyst
│   Coverage: AUCP, SGLN
│   Focus: Gold price drivers, central bank reserves, miner margins, physical flows
│   Web searches: central bank data, gold price, miner earnings, ETF flows
│
├── Agent 3: Defence & Geopolitics Analyst
│   Coverage: ARMG
│   Focus: NATO spending, EU procurement, contractor backlogs, conflicts
│   Web searches: defence contracts, budget votes, geopolitical developments
│
└── Agent 4: Macro & Cross-Asset Analyst
    Coverage: Entire portfolio (cross-cutting)
    Focus: USD/EUR/GBP, interest rates, inflation, cross-asset correlations
    Web searches: central bank decisions, macro data releases, currency moves

FUNCTIONAL AGENTS (4)
│
├── Agent 5: Portfolio Risk Assessor
│   Input: All research outputs + market data
│   Output: Correlation changes, allocation drift, volatility regime, alerts
│
├── Agent 6: News-to-Timeline Mapper
│   Input: All research outputs
│   Output: Structured events with { date, tickers[], headline, sentiment, source_url }
│   Purpose: Powers the chart event markers on frontend
│
├── Agent 7: Action Recommender
│   Input: All research outputs + risk assessment + judge evaluations
│   Output: Recommended actions (CLEARLY LABELLED INFORMATIONAL ONLY)
│   Has its own predictions that the Judge also evaluates
│
└── Agent 8: LLM-as-Judge Evaluator
    Input: Previous week's predictions + actual market outcomes
    Searches web to verify what happened
    Output: Per-prediction accuracy scores + overall agent score
    Runs FIRST in the weekly cycle (before research agents)

CONVERSATIONAL AGENT (1) — NEW
│
└── Agent 9: Portfolio Chatbot
    Always available in the frontend
    Memory: User's portfolio profile (positions, themes, allocations)
    Tools:
      Tool 1: Web search (Gemini grounding) for real-time queries
      Tool 2: Report history search (queries past agent_outputs table)
    Examples:
      "Why did SMGB drop 4% yesterday?" → web search + portfolio context
      "What did the AI Stack agent say about TSMC last month?" → report history search
      "Should I be worried about my gold allocation?" → portfolio context + web search
    NOT a research agent — it doesn't produce predictions or get judged.
    It's a conversational interface to the system's accumulated knowledge.
```

### Agent 9 (Chatbot) — Architecture Detail

This is the agent the user interacts with directly. It needs two tools:

```python
# Tool 1: Web Search
# Uses Gemini's built-in Google Search grounding
# Triggered when user asks about current events, prices, news

# Tool 2: Report History Search
# Queries the agent_outputs table in Postgres
# Triggered when user asks about past analysis, predictions, or recommendations

class ReportHistoryTool:
    """Searches past agent outputs for relevant information."""
    
    def search(self, query: str, agent_name: str = None, 
               weeks_back: int = 12) -> list[dict]:
        """
        Searches agent_outputs table using semantic similarity
        or keyword matching on summary + structured_data fields.
        
        Returns: List of relevant past agent outputs with dates
        and judge evaluations (so the chatbot can say 
        "the AI Stack agent predicted X three weeks ago 
        and was rated 8/10 accurate by the judge").
        """
        # Implementation: pg_trgm for keyword search, 
        # or pgvector for semantic search (future enhancement)
        pass
```

The chatbot's system prompt includes the full portfolio context:

```
You are PortfolioIQ Assistant, a conversational AI for an ETF portfolio investor.

PORTFOLIO CONTEXT:
{dynamically injected: positions, themes, current values, P&L, latest alerts}

You have two tools:
1. web_search: Search the internet for current financial information
2. report_history: Search past weekly agent analyses and evaluations

RULES:
- Always ground responses in the user's actual portfolio
- When citing past agent analysis, include the date and the Judge's accuracy score
- Never give financial advice. Say "Based on the analysis..." not "You should..."
- If unsure, say so. Do not fabricate agent outputs.
- Include disclaimers when discussing any actionable information.
```

### Deep Research Mode for Reports

When generating monthly reports, agents switch from standard mode to deep research:

```python
# Standard weekly mode
generation_config = {
    "temperature": 0.3,        # Lower creativity, higher factuality
    "max_output_tokens": 4096,
}

# Deep research mode for monthly reports
generation_config = {
    "temperature": 0.2,
    "max_output_tokens": 16384,  # Much longer output allowed
    # Gemini thinking mode with 10min cap
    "thinking_config": {
        "enabled": True,
        "budget_tokens": 32768,  # ~10 minutes of thinking
    }
}
```

In deep research mode, each agent:
- Makes more web searches (5-10 instead of 2-3)
- Produces longer, more detailed analysis
- Includes source citations with URLs
- Cross-references multiple sources for each claim
- The report writer synthesises these deeper outputs into the docx schema

---

## Part 3: The Sentiment Tracking System

You asked for a sentiment line chart tracking agent scores across weeks. Here's how it works:

### Data Model

```sql
-- Cumulative agent accuracy tracking (derived from agent_outputs + judge evaluations)
-- This is a materialized view or computed on read

-- Query pattern:
SELECT 
    ao.agent_name,
    ao.run_date,
    (ao.judge_evaluation->>'overall_score')::float AS accuracy_score,
    -- Rolling 4-week average
    AVG((ao.judge_evaluation->>'overall_score')::float) 
        OVER (PARTITION BY ao.agent_name 
              ORDER BY ao.run_date 
              ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS rolling_4w_avg
FROM agent_outputs ao
WHERE ao.judge_evaluation IS NOT NULL
ORDER BY ao.agent_name, ao.run_date;
```

### What the Frontend Renders

**Sentiment/Accuracy Line Chart** (on Analysis page, Agent Reports tab):

- X-axis: Weeks (Week 1, Week 2, ... Week N)
- Y-axis: Judge accuracy score (0-10)
- Lines: One per agent (AI Stack, Gold, Defence, Macro, Action Recommender)
- Each line shows the rolling 4-week average accuracy
- Individual weekly scores shown as dots on hover
- Color coding: Green (>7), Amber (4-7), Red (<4)
- Warning banner when any agent drops below 4.0 for 3+ consecutive weeks

**Aggregate Portfolio Confidence Indicator** (on Dashboard):

- Single number: weighted average of all agent accuracy scores
- Displayed as: "System Confidence: 7.2/10 (12-week avg)"
- Traffic light: Green >7, Amber 5-7, Red <5
- Tooltip: breakdown per agent

---

## Part 4: News-to-Chart Event Pipeline (Revised)

### How Events Get From Agents to Chart Markers

```
Agent 1-4 output (text with facts and dates)
        │
        ▼
Agent 6: News-to-Timeline Mapper
        │
        │ Extracts structured events:
        │ {
        │   "event_date": "2026-03-15",
        │   "headline": "TSMC Arizona fab yields match Taiwan production",
        │   "tickers": ["SMGB", "XAIX"],
        │   "themes": ["ai_stack"],
        │   "sentiment": "positive",
        │   "importance": 4,
        │   "source_url": "https://...",
        │   "source_agent": "ai_stack_analyst"
        │ }
        │
        ▼
chart_events table (Postgres)
        │
        ▼
GET /api/events?tickers=SMGB&from=2026-01-01&to=2026-03-31
        │
        ▼
Frontend: lightweight-charts markers
        │
        │ Renders as small triangles on the price chart:
        │   ▲ Green triangle = positive event
        │   ▼ Red triangle = negative event
        │   ● Grey dot = neutral event
        │
        │ Size scaled by importance (1-5)
        │
        │ Click/hover → tooltip:
        │   "Mar 15: TSMC Arizona fab yields match Taiwan"
        │   "Source: Reuters | Agent: AI Stack | Sentiment: Positive"
        │   [Open source ↗]
        │
        ▼
User sees contextual WHY directly on the price chart
```

### Agent 6 Prompt (Date Parsing Emphasis)

```
You are a financial event extractor. Your ONLY job is to extract 
discrete, dated events from research reports and structure them 
for chart display.

CRITICAL RULES FOR DATES:
- Every event MUST have a specific date in YYYY-MM-DD format
- If the report says "this week" → use {current_monday_date}
- If the report says "last Tuesday" → calculate the exact date
- If the report says "in February" → use 2026-02-15
- If the report says "Q1 2026" → use 2026-02-15
- If NO date can be inferred → DO NOT include the event
- NEVER fabricate dates. If ambiguous, skip the event.

CRITICAL RULES FOR TICKERS:
- Map every event to one or more portfolio ETFs using these rules:
  XAIX: Alphabet, Apple, Palantir, Microsoft, Meta, Oracle, Amazon, AI software, big data
  SMGB: ASML, AMD, TSMC, Broadcom, NVIDIA, Micron, semiconductors, chips
  VPNG: Equinix, Digital Realty, American Tower, data centers, cloud infrastructure
  URNG: Cameco, uranium, nuclear energy, reactors, SMRs
  AUCP: Newmont, Agnico Eagle, gold miners, gold mining
  SGLN: Gold price, physical gold, central bank gold reserves, gold demand
  ARMG: Rheinmetall, BAE, RTX, Lockheed, defence spending, NATO, military
- If an event affects multiple ETFs, include ALL relevant tickers

Output: JSON array of events. Nothing else.
```

---

## Part 5: Frontend — 3 Pages (Confirmed)

### Page 1: DASHBOARD

```
┌─────────────────────────────────────────────────────┐
│ PortfolioIQ                        [Chat] [Profile] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  HEALTH SUMMARY                                     │
│  "Your portfolio: €10,847 (+8.5%) this month"       │
│  System Confidence: 7.2/10 | Next agent run: Mon    │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  PORTFOLIO VALUE CHART (lightweight-charts)   │   │
│  │  Area chart with entry marker + event markers │   │
│  │  Toggle: Total / By Theme / By ETF           │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  THEME CARDS (3 across)                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ AI Stack    │ │ Gold        │ │ Defence     │   │
│  │ +11.2%      │ │ +3.1%       │ │ +6.8%       │   │
│  │ Latest:     │ │ Latest:     │ │ Latest:     │   │
│  │ "TSMC..."   │ │ "Gold at.." │ │ "EU appro.."│   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                     │
│  ALLOCATION BAR (current vs target)                 │
│  [XAIX 22%|SMGB 17%|AUCP 16%|ARMG 15%|...]       │
│  ⚠ XAIX drifted +2% above target                   │
│                                                     │
│  LATEST ALERTS (top 3)                              │
│  🟢 Gold hits $5,230 — new ATH          3d ago     │
│  🟡 URNG volatility spike: 48.2%        1d ago     │
│  🔵 SMGB crossed +15% from entry        2h ago     │
│                                                     │
│  QUICK ACTIONS                                      │
│  [Generate Report] [Full Analysis →] [Alerts ⚙]    │
│                                                     │
├─────────────────────────────────────────────────────┤
│  💬 Chat with PortfolioIQ...                  [▸]   │
│  (Expandable chatbot bar — Agent 9)                 │
└─────────────────────────────────────────────────────┘
```

### Page 2: ANALYSIS

```
┌─────────────────────────────────────────────────────┐
│  CHART WORKSPACE                                    │
│  ┌───────────────────────────────────────┐          │
│  │ Chart type: [Line] [Bar] [Risk-Ret]   │          │
│  │             [Heatmap] [Drawdown]       │          │
│  │                                        │          │
│  │ ETF toggles: [XAIX] [SMGB] [AUCP]... │          │
│  │ Events overlay: [ON/OFF]              │          │
│  │ Add comparison: [MSCI World] [S&P500] │          │
│  │                                        │          │
│  │  ┌────────────────────────────────┐   │          │
│  │  │   Interactive chart area       │   │          │
│  │  │   with event markers           │   │          │
│  │  │   and entry point annotation   │   │          │
│  │  └────────────────────────────────┘   │          │
│  └───────────────────────────────────────┘          │
│                                                     │
│  TABS: [ETF Detail] [Agent Reports] [Alerts] [Chat] │
│                                                     │
│  ETF DETAIL (when ETF selected):                    │
│    justETF-equivalent data card                     │
│    Holdings, sectors, countries, overlap analysis    │
│                                                     │
│  AGENT REPORTS (tabbed by agent):                   │
│    Latest output with reflection section            │
│    Predictions table with confidence                │
│    ┌──────────────────────────────────┐             │
│    │ SENTIMENT/ACCURACY LINE CHART    │             │
│    │ Agent scores over weeks          │             │
│    │ Rolling 4-week average           │             │
│    │ Warning if agent <4.0 for 3 weeks│             │
│    └──────────────────────────────────┘             │
│    Historical accuracy per agent                    │
│                                                     │
│  RECOMMENDATIONS (Agent 7 output):                  │
│    ⚠ DISCLAIMER BANNER (always visible)             │
│    Recommended actions with reasoning               │
│    Agent 7 accuracy track record                    │
│                                                     │
│  ALERTS:                                            │
│    Threshold configuration (add/edit/delete)        │
│    Alert event history log                          │
└─────────────────────────────────────────────────────┘
```

### Page 3: REPORTS

```
┌─────────────────────────────────────────────────────┐
│  GENERATE REPORT                                    │
│  Type: [Weekly Health] [Monthly Deep Research]       │
│  Date range: [auto] or [custom]                     │
│  Sections: ☑ Exec Summary ☑ AI Stack ☑ Gold ...    │
│  Mode: Deep Research (10min thinking cap)           │
│  [Generate Report]                                  │
│                                                     │
│  ⏳ Generating... Agent 1/4 researching... (3:42)    │
│                                                     │
│  REPORT ARCHIVE                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Mar 2026 │ Monthly │ "Portfolio +8.5%, gold  │   │
│  │          │         │  leads..." [View] [↓]   │   │
│  │ W10 2026 │ Weekly  │ "SMGB +4.2% on TSMC..." │   │
│  │          │         │               [View] [↓] │   │
│  │ W9 2026  │ Weekly  │ "Software correction..." │   │
│  │          │         │               [View] [↓] │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  AGENT MEMORY EXPLORER                              │
│  Timeline: what each agent said, week by week       │
│  Judge scores overlaid                              │
│  Cumulative accuracy trends                         │
│  "Trust dashboard" — is the system getting smarter? │
└─────────────────────────────────────────────────────┘
```

### The Chatbot (Agent 9) — UI Placement

The chatbot lives as a **collapsible bar at the bottom of every page**. Click to expand into a chat panel (like Intercom). It persists across page navigation. Conversation history is stored per session and optionally persisted to Postgres for the report history tool to reference.

---

## Part 6: Database Schema (Updated for v3)

All changes from v2 are marked with `-- v3 NEW` or `-- v3 CHANGED`.

```sql
-- ═══ USERS ═══
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    base_currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ PORTFOLIOS ═══
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ THEMES ═══
CREATE TABLE portfolio_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0
);

-- ═══ ETF REGISTRY (shared reference data) ═══
CREATE TABLE etfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isin VARCHAR(12) UNIQUE NOT NULL,
    ticker_yf VARCHAR(20),                    -- yfinance ticker (e.g., SMGB.L)
    name VARCHAR(200) NOT NULL,
    currency VARCHAR(3),
    exchange VARCHAR(20),
    
    -- From justetf-scraping (refreshed weekly)
    ter DECIMAL(5,4),
    aum_eur BIGINT,
    inception_date DATE,
    domicile VARCHAR(50),
    replication VARCHAR(50),
    distribution VARCHAR(20),
    description TEXT,                          -- v3 NEW
    holdings_count INTEGER,
    vol_1y DECIMAL(6,2),
    vol_3y DECIMAL(6,2),
    ret_risk_1y DECIMAL(6,2),
    max_dd_1y DECIMAL(6,2),
    
    last_scraped_at TIMESTAMPTZ
);

-- ═══ ETF HOLDINGS (from justetf-scraping) ═══
CREATE TABLE etf_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etf_id UUID REFERENCES etfs(id),
    holding_name VARCHAR(200),
    holding_isin VARCHAR(12),                 -- v3 NEW: for overlap detection
    holding_ticker VARCHAR(20),
    weight DECIMAL(6,4),
    refreshed_at TIMESTAMPTZ
);

-- ═══ ETF ALLOCATIONS (sectors/countries from justetf-scraping) ═══
CREATE TABLE etf_allocations (                -- v3 NEW
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etf_id UUID REFERENCES etfs(id),
    allocation_type VARCHAR(10) NOT NULL,      -- 'sector' or 'country'
    name VARCHAR(100) NOT NULL,
    percentage DECIMAL(6,2),
    refreshed_at TIMESTAMPTZ
);

-- ═══ POSITIONS ═══
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    etf_id UUID REFERENCES etfs(id),
    theme_id UUID REFERENCES portfolio_themes(id),
    layer_label VARCHAR(50),
    target_allocation DECIMAL(5,2),
    entry_date DATE NOT NULL,
    entry_price DECIMAL(12,4) NOT NULL,
    shares DECIMAL(12,6) NOT NULL,
    invested_amount DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ TRANSACTIONS ═══
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID REFERENCES positions(id),
    type VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    price DECIMAL(12,4) NOT NULL,
    shares DECIMAL(12,6) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ PRICES (daily time series) ═══
CREATE TABLE prices (
    etf_id UUID REFERENCES etfs(id),
    date DATE NOT NULL,
    open DECIMAL(12,4),
    high DECIMAL(12,4),
    low DECIMAL(12,4),
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT,
    PRIMARY KEY (etf_id, date)
);

-- ═══ PORTFOLIO SNAPSHOTS (daily computed state) ═══
CREATE TABLE portfolio_snapshots (            -- v3 NEW
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id),
    date DATE NOT NULL,
    total_value DECIMAL(12,2),
    total_pnl DECIMAL(12,2),
    total_pnl_pct DECIMAL(8,4),
    allocations JSONB,                        -- { "XAIX": 21.3, "SMGB": 17.8, ... }
    UNIQUE(portfolio_id, date)
);

-- ═══ AGENT OUTPUTS (the memory system) ═══
CREATE TABLE agent_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    agent_name VARCHAR(50) NOT NULL,
    run_date DATE NOT NULL,
    run_type VARCHAR(20) NOT NULL,
    
    -- Output content
    summary TEXT NOT NULL,
    structured_data JSONB NOT NULL,
    reflection TEXT,                           -- v3 NEW: agent's self-reflection on past performance
    
    -- Predictions for judge evaluation
    predictions JSONB,
    
    -- Judge evaluation (filled by Agent 8 the following week)
    judge_evaluation JSONB,
    judge_run_date DATE,
    judge_overall_score DECIMAL(4,2),         -- v3 NEW: denormalized for fast charting
    
    -- Deep research metadata                  -- v3 NEW
    research_mode VARCHAR(20),                 -- 'standard' or 'deep_research'
    thinking_tokens_used INTEGER,
    sources_cited JSONB,                       -- [{ url, title, accessed_date }]
    
    -- Cost tracking
    model_used VARCHAR(50),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(portfolio_id, agent_name, run_date, run_type)
);

-- v3 NEW: Fast index for sentiment chart queries
CREATE INDEX idx_agent_scores 
ON agent_outputs(portfolio_id, agent_name, run_date DESC) 
WHERE judge_overall_score IS NOT NULL;

-- ═══ CHART EVENTS (from Agent 6) ═══
CREATE TABLE chart_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    agent_output_id UUID REFERENCES agent_outputs(id),
    event_date DATE NOT NULL,
    headline VARCHAR(200) NOT NULL,
    description TEXT,
    source_url VARCHAR(500),
    tickers VARCHAR(10)[] NOT NULL,
    themes VARCHAR(50)[],
    sentiment VARCHAR(10),
    importance INTEGER CHECK (importance BETWEEN 1 AND 5),
    source_agent VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ ALERTS ═══
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    etf_id UUID REFERENCES etfs(id),
    threshold DECIMAL(12,4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES alerts(id),
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    actual_value DECIMAL(12,4),
    message TEXT
);

-- ═══ REPORTS ═══
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    summary_sentence TEXT,
    file_path VARCHAR(500),
    agent_output_ids UUID[],
    schema_config JSONB,
    research_mode VARCHAR(20)                  -- v3 NEW: 'standard' or 'deep_research'
);

-- ═══ CHATBOT CONVERSATIONS (Agent 9) ═══     -- v3 NEW
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL,                 -- 'user' or 'assistant'
    content TEXT NOT NULL,
    tools_used JSONB,                          -- [{ tool: 'web_search', query: '...' }]
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 7: Build Sequence (Revised)

### Phase 1: Data Foundation (Week 1-2)
- Supabase/Postgres schema deployment (Alembic migrations)
- yfinance integration: daily price fetch for 7 ETFs
- justetf-scraping integration: ETF profiles, holdings, charts
- FastAPI endpoints: portfolio CRUD, prices, ETF detail
- Auth0 passwordless email OTP
- **Milestone: Can add ETFs and see real prices in API responses**

### Phase 2: Frontend Shell (Week 3-4)
- Vite + React + Tailwind + shadcn scaffolding
- Dashboard page: health summary, portfolio chart (lightweight-charts), theme cards
- Analysis page: chart workspace with type switching, ETF detail panel
- Reports page: empty archive view
- Auth0 integration + JWT flow
- **Milestone: Working dashboard with real data from API**

### Phase 3: Agent System — Core Loop (Week 5-7)
- LangChain + Gemini setup with Google Search grounding
- Agents 1-4 (research) with system prompts and portfolio context injection
- Agent 8 (Judge) with evaluation prompt
- Weekly memory-reflection loop implementation
- Agent output storage in Postgres
- **Milestone: Agents produce weekly analyses that reference past accuracy**

### Phase 4: Functional Agents + Events (Week 8-9)
- Agent 5 (Risk Assessor)
- Agent 6 (News-to-Timeline Mapper) — event extraction + date parsing
- Agent 7 (Action Recommender) — separated recommendations with disclaimers
- Chart event markers on frontend (lightweight-charts markers API)
- Sentiment/accuracy line chart on frontend
- **Milestone: Charts show WHY things moved, agents have visible track records**

### Phase 5: Chatbot + Reports (Week 10-11)
- Agent 9 (Chatbot) with web search + report history tools
- Chat UI (collapsible panel on all pages)
- Report generation with deep research mode (10min thinking cap)
- docx output using template + agent outputs
- Report archive with download
- **Milestone: Can chat about portfolio and generate monthly reports**

### Phase 6: Polish + SaaS Prep (Week 12+)
- Alert system (thresholds, email notifications via Resend)
- Onboarding flow for new users (add your own ETFs, define themes)
- ETF discovery search (integrate theperu scraper for browse/search)
- Prompt versioning system
- Rate limiting, cost metering per user
- Legal: disclaimer in footer, terms of service, privacy policy
- **Milestone: Ready for beta users**

---

## Open Threads Resolved

| Thread | v2 Status | v3 Resolution |
|--------|-----------|---------------|
| Prompt versioning | Deferred | **Code-versioned for now. Future: external agent builder platform with API tokens.** User will build a separate app for this. |
| Cold start | Discussed | **Warm-up mode: first week agents run without reflection. Judge skips. Memory begins accumulating from week 2.** |
| Scale costs | Estimated | **Not relevant yet. Building for single user. Will revisit at 10+ users.** |
| Report generation | Gemini only | **Deep research mode with 10min thinking cap. Gemini 3 Pro handles synthesis.** |
| Agent accuracy degradation | Warning vs auto-adjust | **Warning banner when agent <4.0 for 3+ weeks. Sentiment line chart makes it visually obvious. No auto-adjustment — user decides.** |
| Disclaimers | Agreed | **Footer on every page. Banner before Agent 7 recommendations. Embedded in every report. Terms of service at signup.** |