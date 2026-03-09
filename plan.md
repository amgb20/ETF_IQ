# PortfolioIQ — Build Plan

> Derived from `overview.md` (Architecture v3 Final Pre-Build Specification).
> Each phase ends with a testable milestone. Tasks are ordered by dependency.

---

## Phase 1 — Data Foundation

**Goal:** API returns real ETF prices and structural data. No frontend yet.

### 1.1 Repository & Environment Setup
- [x] Initialise monorepo structure (`frontend/`, `unified-api/`, `db/`, `data-connectors/`)
- [x] Create `docker-compose.yml` with `postgres:15`, `unified-api`, `frontend` services
- [x] Create `.env.example` with all required variables (Auth0, Gemini key, DB URL)
- [x] Configure Alembic in `unified-api/` pointing at the Postgres service

### 1.2 Database Schema
- [x] Write Alembic initial migration implementing every table from overview Part 6:
  - `users`, `portfolios`, `portfolio_themes`
  - `etfs`, `etf_holdings`, `etf_allocations`
  - `positions`, `transactions`
  - `prices`, `portfolio_snapshots`
  - `agent_outputs`, `chart_events`
  - `alerts`, `alert_events`
  - `reports`
  - `chat_sessions`, `chat_messages`
- [x] Add all indexes (including `idx_agent_scores` for sentiment chart queries)
- [x] Seed script: insert the 7 portfolio ETFs into `etfs` table with their ISINs and yfinance tickers

### 1.3 Data Connector — yfinance
- [x] Scaffold `data-connectors/yfinance/` implementing `BaseConnector`
- [x] `fetch()`: `yf.download()` for a list of tickers, configurable period
- [x] `normalize()`: map yfinance DataFrame columns → `prices` table schema (OHLCV + etf_id + date)
- [x] `ingest()`: upsert normalized rows into `prices` (ON CONFLICT DO NOTHING for existing dates)
- [x] Additional fetch: `EURUSD=X` for EUR/USD rate storage
- [x] Unit tests for normalize and upsert logic

### 1.4 Data Connector — justetf-scraping
- [x] Scaffold `data-connectors/justetf/` implementing `BaseConnector`
- [x] `fetch()`: call `get_etf_overview(isin)` and `load_chart(isin)` for each portfolio ISIN
- [x] `normalize()`: map overview dict → `etfs` columns (TER, AUM, description, vol, max_dd)
- [x] `normalize()`: map holdings list → `etf_holdings` rows (with `holding_isin` for overlap)
- [x] `normalize()`: map countries/sectors → `etf_allocations` rows
- [x] `ingest()`: upsert all derived rows, update `last_scraped_at` on `etfs`
- [x] Overlap computation: cross-reference `holding_isin` across all portfolio ETFs → store result
- [x] Comparison chart fetch: `compare_charts()` for all 7 ISINs → store rebased data
- [x] Unit tests covering normalization edge cases

### 1.5 Connector Registry & Scheduler
- [x] `ConnectorRegistry` class: register/lookup connectors by name
- [x] APScheduler (or equivalent) wired in FastAPI lifespan:
  - Daily 06:00 UTC: yfinance batch pull → alert evaluation → portfolio snapshot
  - Weekly Sunday 22:00 UTC: justetf full refresh + overlap analysis + comparison chart
  - Monday 08:00 UTC: trigger weekly agent cycle (stubbed — wired in Phase 3)
- [x] Manual trigger endpoint `POST /admin/connectors/{name}/run` (admin-only)

### 1.6 Core API — Portfolio & Price Endpoints
- [x] `POST /portfolios` — create portfolio
- [x] `GET /portfolios/{id}` — portfolio with positions, current values, P&L
- [x] `POST /portfolios/{id}/positions` — add position
- [x] `GET /etfs/{isin}` — ETF detail (data from `etfs` + `etf_holdings` + `etf_allocations`)
- [x] `GET /prices?etf_id=&from=&to=` — OHLCV time series
- [x] `GET /portfolios/{id}/snapshot` — latest daily snapshot (value, P&L, allocation %)
- [x] `GET /portfolios/{id}/overlap` — holding overlap matrix across positions

### 1.7 Auth0 Integration
- [ ] Register Auth0 tenant, enable passwordless email OTP flow
- [x] FastAPI dependency `require_auth`: validate Auth0 JWT (JWKS endpoint), extract `sub`
- [x] Auto-provision `users` row on first authenticated request (upsert by `auth0_id`)
- [x] Internal HS256 JWT helper for service-to-service calls (signed with `JWT_SECRET`)
- [x] Role middleware: attach role from `users.role` to request context

**Milestone:** `GET /portfolios/{id}` returns real ETF prices and justETF structural data for all 7 positions. Auth0 OTP login works end-to-end.

---

## Phase 2 — Frontend Shell

**Goal:** Working dashboard with live data.

### 2.1 Scaffolding
- [x] Vite 6 + React 18 + TypeScript project in `frontend/`
- [x] Tailwind CSS 3 config
- [x] shadcn-style component library bootstrapped in `frontend/src/components/ui/`
  - Base components: Button, Card, Badge, Tabs, Sheet, Tooltip, Dialog, Select
- [x] React Router v6: routes for `/`, `/analysis`, `/reports`
- [x] TanStack React Query client with Auth0 token injected as Bearer header
- [x] Auth0 React SDK: `<Auth0Provider>` wrapping app, `useAuth0()` throughout
- [x] Global layout: top nav (logo, page links, Chat button, Profile menu)

### 2.2 Dashboard Page (`/`)
- [x] **Health Summary bar**: total portfolio value, monthly P&L %, system confidence indicator, next agent run countdown
- [x] **Portfolio Value Chart** (lightweight-charts v5 area chart):
  - Toggle: Total value / By Theme / By ETF
  - Entry price marker annotation
  - Event markers layer (empty for now — wired in Phase 4)
- [x] **Theme Cards** (3 across — AI Stack, Gold, Defence):
  - Theme P&L %, constituent ETFs, latest agent summary snippet (placeholder)
- [x] **Allocation Bar**: current allocation % vs target, drift warning badge
- [x] **Latest Alerts panel**: top 3 alert events, severity colour coding
- [x] **Quick Actions**: buttons for Generate Report, Full Analysis →, Alerts config
- [x] **Chatbot bar** (collapsed stub at bottom — wired in Phase 5)

### 2.3 Analysis Page (`/analysis`)
- [x] **Chart Workspace** (lightweight-charts v5):
  - Chart type switcher: Line, Bar, Risk-Return scatter, Heatmap, Drawdown
  - ETF toggle buttons (XAIX, SMGB, AUCP, ARMG, AUCP, SGLN, VPNG, URNG)
  - Event overlay toggle (disabled until Phase 4)
  - Benchmark comparison selector (MSCI World, S&P 500 — via yfinance)
- [x] **Tabs below chart**: ETF Detail, Agent Reports, Alerts
- [x] **ETF Detail tab**: justETF-style data card — TER, AUM, inception, domicile, replication, holdings table (top 10), sector allocation bar (Recharts), country allocation bar (Recharts), overlap warning badges
- [x] **Agent Reports tab**: placeholder cards for agents 1-8, sentiment/accuracy chart stub (Recharts line chart — data wired in Phase 4)
- [x] **Alerts tab**: alert list with enable/disable toggle; threshold creation form (ETF, type, value)

### 2.4 Reports Page (`/reports`)
- [x] **Generate Report form**: type selector (Weekly Health / Monthly Deep Research), date range picker, section checkboxes, mode label
- [x] **Progress indicator**: agent step counter + elapsed timer (polling `/reports/{id}/status`)
- [x] **Report Archive table**: type, date, summary sentence, View + Download actions
- [x] **Agent Memory Explorer**: timeline view — agent name rows, week columns, judge score badges (empty until Phase 3)

### 2.5 API Integration
- [x] React Query hooks for all Phase 1 endpoints
- [x] Optimistic updates for position add/edit
- [x] Error boundary + toast notification system (shadcn `<Sonner>` or equivalent)
- [x] Loading skeleton components for chart and card areas

**Milestone:** Dashboard renders real price chart and ETF structural data. Auth0 login/logout works. All three pages navigable with correct layouts.

---

## Phase 3 — Agent System Core Loop

**Goal:** Agents 1–4 + Judge produce weekly analyses that reference their own past accuracy.

### 3.1 Gemini Client Setup
- [x] `unified-api/agents/llm_client.py`: singleton `google-genai` client
- [x] Standard generation config (temp 0.3, max_tokens 4096)
- [x] Deep research config (temp 0.2, max_tokens 16384, thinking_config with 32768 budget tokens)
- [x] Google Search grounding helper (wraps Gemini's built-in search tool)
- [x] Token + latency logging → `agent_outputs` cost tracking columns

### 3.2 Agent Base Class
- [x] `BaseAgent`: abstract class with:
  - `agent_name: str`
  - `build_prompt(portfolio_context, market_data, past_output, judge_eval) -> str`
  - `run(portfolio_id, run_date, run_type) -> AgentOutput`
  - `store_output(output) -> UUID` — upsert into `agent_outputs`
  - `load_past_output(portfolio_id, weeks_back) -> AgentOutput | None`
- [x] Portfolio context builder: assembles positions, current values, allocations, P&L into a structured string injected into every agent prompt
- [x] Prediction parser: extracts structured `{ prediction, confidence, timeframe }` blocks from agent text → stores in `predictions` JSONB column

### 3.3 Research Agents (Agents 1–4)
- [x] **Agent 1 — AI Stack Analyst**
  - Coverage: XAIX, SMGB, VPNG, URNG
  - System prompt: AI capex, semiconductor supply, data center capacity, nuclear energy
  - Web search targets: earnings reports, capex announcements, chip supply chain
- [x] **Agent 2 — Gold & Precious Metals Analyst**
  - Coverage: AUCP, SGLN
  - System prompt: gold price drivers, central bank reserves, miner margins, physical flows
  - Web search targets: central bank data, gold price, miner earnings, ETF flows
- [x] **Agent 3 — Defence & Geopolitics Analyst**
  - Coverage: ARMG
  - System prompt: NATO spending, EU procurement, contractor backlogs, conflicts
  - Web search targets: defence contracts, budget votes, geopolitical developments
- [x] **Agent 4 — Macro & Cross-Asset Analyst**
  - Coverage: entire portfolio
  - System prompt: USD/EUR/GBP, interest rates, inflation, cross-asset correlations
  - Web search targets: central bank decisions, macro data releases, currency moves
- [x] Reflection injection: when `past_output` + `judge_eval` present, prepend reflection instruction to each agent prompt
- [x] Cold-start guard: Week 1 runs without reflection (no past output); Judge skips evaluation

### 3.4 Agent 8 — LLM-as-Judge Evaluator
- [x] Load all predictions from previous week's `agent_outputs` (agents 1-4 + agent 7)
- [x] Fetch actual market data for the past week from `prices` table
- [x] Web search to verify what actually happened
- [x] For each prediction: correct / partially correct / wrong, confidence calibration check, score 1–10
- [x] Compute `judge_overall_score` per agent
- [x] Write evaluation back to previous week's `agent_outputs.judge_evaluation` column
- [x] Must run **before** research agents in the weekly cycle

### 3.5 Weekly Orchestrator
- [x] `WeeklyOrchestrator.run(portfolio_id, run_date)`:
  1. Run Agent 8 (Judge) — evaluate last week's predictions
  2. Run Agents 1–4 in parallel (asyncio.gather) with reflection context injected
  3. Stub calls for Agents 5, 6, 7 (stubbed — wired in Phase 4)
  4. Trigger email digest (stubbed)
- [x] Wire to Monday 08:00 UTC cron in the scheduler
- [x] `POST /admin/agents/run` endpoint — manual trigger for testing
- [x] `GET /agent-outputs?portfolio_id=&agent=&weeks=12` — paginated output history

**Milestone:** Weekly cron fires, Agents 1–4 run in parallel with Google Search grounding, outputs stored in DB with predictions. Week 2+ includes Judge evaluation and agent reflection.

---

## Phase 4 — Functional Agents + Event System

**Goal:** Charts show WHY things moved. Agents have visible track records on the frontend.

### 4.1 Agent 5 — Portfolio Risk Assessor
- [x] Input: all research outputs from current cycle + latest `prices` rows
- [x] Compute: correlation matrix across ETFs (price data), allocation drift vs targets, volatility regime classification
- [x] Output: structured risk summary stored in `agent_outputs` + any triggered alert conditions
- [x] Wire into `WeeklyOrchestrator` after Agents 1–4

### 4.2 Agent 6 — News-to-Timeline Mapper
- [x] Input: all Agent 1–4 text outputs from current cycle
- [x] Prompt: full Agent 6 system prompt from overview (date parsing rules, ticker mapping rules)
- [x] Output: JSON array of chart events parsed strictly to schema
- [x] Store each event into `chart_events` table (linked to `agent_output_id`)
- [x] `GET /events?portfolio_id=&tickers=&from=&to=` endpoint

### 4.3 Agent 7 — Action Recommender
- [x] Input: all research outputs + Agent 5 risk assessment + judge evaluations
- [x] Output: recommended actions with reasoning, explicit disclaimers embedded in output text
- [x] Disclaimer banner always included in `structured_data.disclaimer` field
- [x] Agent 7's own predictions stored for Judge evaluation next week
- [x] Wire into `WeeklyOrchestrator` after Agent 5

### 4.4 Alert Evaluation Engine
- [x] Daily cron: load all active `alerts` for each portfolio
- [x] Check latest `prices` close against each threshold type (price_above, price_below, pct_change, volatility)
- [x] On breach: insert `alert_events` row, update `alerts.last_triggered_at` and `trigger_count`
- [x] `GET /alerts?portfolio_id=` — list with history
- [x] `POST /alerts`, `PUT /alerts/{id}`, `DELETE /alerts/{id}` endpoints

### 4.5 Frontend — Chart Event Markers
- [x] Fetch events from `GET /events` via React Query, keyed by selected ETF + date range
- [x] Render lightweight-charts `SeriesMarker` objects:
  - `▲` shape, green = positive sentiment
  - `▼` shape, red = negative sentiment
  - `●` circle, grey = neutral
  - Size mapped from `importance` (1–5)
- [x] Hover tooltip: headline, source, agent name, sentiment, [Open source ↗] link
- [x] Event overlay toggle (ON/OFF switch in Analysis chart workspace)

### 4.6 Frontend — Sentiment / Accuracy Chart
- [x] Query rolling 4-week average accuracy from `GET /agent-outputs/scores`
- [x] Recharts `<LineChart>` on Analysis → Agent Reports tab:
  - X-axis: week dates
  - Y-axis: Judge score 0–10
  - One `<Line>` per agent, colour-coded
  - Dots on hover showing individual weekly scores
  - Reference lines at 7.0 and 4.0
  - Colour zones: green >7, amber 4–7, red <4
- [x] Warning banner rendered if any agent has score < 4.0 for 3+ consecutive weeks
- [x] Dashboard: Aggregate Portfolio Confidence Indicator (weighted avg of all agent scores with traffic light)

### 4.7 Frontend — Alert Management
- [x] Alert configuration form in Analysis → Alerts tab (ETF picker, type, threshold value)
- [x] Alert event history log (sortable by date, filterable by ETF)
- [x] Alert notification badge in nav when unread alert events exist

**Milestone:** Price charts show event markers from Agent 6. Sentiment/accuracy chart shows rolling track record. Alerts trigger and log correctly.

---

## Phase 5 — Chatbot + Reports

**Goal:** User can chat about their portfolio and generate/download deep research reports.

### 5.1 Agent 9 — Portfolio Chatbot Backend
- [x] `ChatAgent` class with persistent Gemini chat session per `chat_session_id`
- [x] System prompt assembled dynamically: portfolio context (positions, values, P&L, latest alerts) injected at session start
- [x] **Tool 1 — Web Search**: Gemini Google Search grounding, triggered for current events / prices / news queries
- [x] **Tool 2 — Report History Search**: queries `agent_outputs` + `agent_outputs.judge_evaluation` using `pg_trgm` keyword search on `summary` + `structured_data` fields; optional filter by `agent_name`; returns relevant past outputs with dates and judge scores
- [x] `POST /chat` — send message, receive streamed response (Server-Sent Events)
- [x] `GET /chat/sessions` — list sessions
- [x] `GET /chat/sessions/{id}/messages` — message history
- [x] Persist each message to `chat_messages` with `tools_used` metadata

### 5.2 Frontend — Chat Panel (Agent 9 UI)
- [x] Collapsible chat bar pinned to bottom of all pages (persists across navigation)
- [x] Expand → slide-up chat panel (like Intercom)
- [x] Message input, send button, streaming response rendering
- [x] Tool-use indicator: show "Searching web..." / "Searching reports..." while tool runs
- [x] Source citation rendering: agent name + date + judge score badge when report history tool returns results
- [x] Session persistence: reload reopens same session with history

### 5.3 Report Generation Engine
- [x] `ReportOrchestrator.generate(portfolio_id, type, date_range, sections, mode)`:
  - `type = 'weekly'`: standard mode, runs Agents 1–7 with standard generation config
  - `type = 'monthly'`: deep research mode (thinking_config with 32768 budget tokens), 5–10 web searches per agent
- [x] Status tracking: `reports` row created immediately with `status = 'pending'`, updated through `running` → `complete` / `failed`
- [x] Report Writer: synthesises all agent outputs into a structured `docx` using `python-docx` — sections: Exec Summary, AI Stack, Gold, Defence, Macro, Risk, Recommendations, Disclaimers
- [x] Store `file_path` on `reports` row, link `agent_output_ids`
- [x] `POST /reports` — trigger generation (returns report ID immediately, async generation)
- [x] `GET /reports/{id}/status` — poll for progress (agent N of M, elapsed time)
- [x] `GET /reports/{id}/download` — stream docx file

### 5.4 Frontend — Reports Page (Wired)
- [x] Generate Report form wired to `POST /reports`
- [x] Progress polling via `GET /reports/{id}/status` with step display and elapsed timer
- [x] Report archive table fetching from `GET /reports?portfolio_id=`
- [x] View action: opens report summary in modal or new tab
- [x] Download action: triggers docx download
- [x] Agent Memory Explorer: populated from `GET /agent-outputs/scores` — timeline grid with judge score badges per week per agent

**Milestone:** User can ask "Why did SMGB drop last week?" and get an answer grounded in past agent analysis. Monthly deep research report generates and downloads as docx.

---

## Phase 6 — Polish & SaaS Prep

**Goal:** Ready for beta users. Onboarding, alerts email, legal, ETF discovery.

### 6.1 Alerts — Email Notifications
- [x] Resend integration: transactional email on `alert_events` insert
- [x] Weekly digest email: summary of agent outputs, top 3 alerts, system confidence score
- [x] Unsubscribe / notification preference stored on `users`

### 6.2 Onboarding Flow
- [x] New user wizard (post-Auth0 signup): create portfolio name, add ETFs by ISIN or search, define themes, set target allocations
- [x] ETF search endpoint `GET /etfs/search?q=` using `pg_trgm` on name + ISIN
- [x] Onboarding completion check: redirect to wizard if portfolio has 0 positions

### 6.3 ETF Discovery (theperu scraper)
- [x] Scaffold `data-connectors/justetf-discovery/` wrapping the theperu scraper
- [x] `GET /etfs/discover?q=&filters=` — search across 3400+ ETFs from justETF
- [x] Add-to-portfolio flow from discovery results

### 6.4 Prompt Versioning
- [x] Agent system prompts stored as versioned constants in `unified-api/agents/prompts/v1/`
- [x] `PROMPT_VERSION` env var controls active version
- [x] Version logged on every `agent_outputs` row for traceability

### 6.5 Production Hardening
- [x] Rate limiting per `user_id` on all LLM-backed endpoints (slowapi)
- [x] Cost metering: track cumulative Gemini token spend per user per month
- [x] `GET /admin/costs` endpoint for cost overview
- [x] Dockerfile production builds: frontend → nginx:alpine, unified-api → python:3.11-slim
- [x] Health check endpoints: `GET /health` (API), nginx `/health` (frontend)
- [x] Environment-specific `.env` files and secret management documentation

### 6.6 Legal & Compliance
- [x] Disclaimer footer on every page: "Not financial advice. Informational only."
- [x] Disclaimer banner before Agent 7 recommendations (Analysis page)
- [x] Disclaimer embedded in every generated report (docx header + footer)
- [x] Terms of Service modal at first signup
- [x] Privacy policy page

**Milestone:** Beta users can sign up, add their own portfolio, receive weekly agent emails, and generate reports. All legal disclaimers in place.

---

## Component Summary


