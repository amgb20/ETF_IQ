# TODOS

## From /plan-eng-review (2026-03-30, branch sc-27/ui-changes)

### 1. Extract shared trade service

**Priority:** High
**What:** Create `unified-api/app/services/trade.py` with `execute_buy()` and `execute_sell()` functions. Both `portfolios.py` endpoints and `chat_agent.py` tools should call these shared functions.
**Why:** Buy/sell logic is duplicated in 2 places. A bug fix in one won't propagate to the other.
**Depends on:** Nothing. Do this first — tests (TODO #4) should test the service, not the endpoints.

### 2. Fix commit() in chat agent tools

**Priority:** High
**What:** Replace `db_session.commit()` with `db_session.flush()` in `_close_trade`, `_open_trade`, and `_create_alert` tool functions in `chat_agent.py`. Let `send_message()` handle the single commit after all tools complete.
**Why:** Concurrent tool calls via `asyncio.gather` can cause race conditions and partial commits.

### 3. Add user_id validation to ChatAgent

**Priority:** High (security)
**What:** Pass `user_id` to `ChatAgent.__init__`. Verify portfolio ownership at construction time.
**Why:** Defense in depth — tools execute trades without secondary auth check.

### 4. Write backend tests for trade endpoints

**Priority:** High
**What:** Create `unified-api/tests/test_trades.py` with pytest tests:

- `test_sell_partial` — sell 5 of 10 shares, verify remaining = 5
- `test_sell_full_close` — sell all shares, verify is_active=False, exit_date set
- `test_sell_more_than_held` — expect 400
- `test_sell_closed_position` — expect 400
- `test_sell_negative_shares` — expect 422
- `test_buy_accumulation` — buy into existing, verify shares/invested
- `test_buy_new_position` — buy new ETF
- `test_list_transactions` — verify realized P&L calculation
- `test_trade_service_execute_sell` — shared service
- `test_trade_service_execute_buy` — shared service
- `test_quote_new_fields` — volume, ytd, yield, ter
- `test_portfolio_detail_pnl` — P&L calculations
  **Why:** Trade calculations affect real money decisions.
  **Depends on:** TODO #1 (extract trade service).

### 5. Add Pydantic validators for trade amounts

**Priority:** Medium
**What:** Add `gt=0` constraints to `shares` and `price` in `PositionCreate`, `PositionSell`. Add `Literal['buy', 'sell']` to `Transaction.type`.
**Why:** Negative/zero values cause division errors. Free-string type allows garbage data.

### 6. Batch fetch latest prices (fix N+1)

**Priority:** Medium
**What:** Replace the per-position `_latest_price()` loop in `get_portfolio()` with a single query using `DISTINCT ON (etf_id) ORDER BY date DESC`.
**Why:** 20 ETFs = 20 extra queries on every portfolio load.

### 7. Change Position.transactions to lazy loading

**Priority:** Low
**What:** In `models/position.py:32`, change `lazy='selectin'` to `lazy='select'`. Add explicit `selectinload()` where transactions are needed.
**Why:** Currently loads all transactions on every position query. Will degrade with trade history.

### 8. Add chatbot trade confirmation step

**Priority:** Medium (safety)
**What:** Before executing `_close_trade` or `_open_trade`, return a preview to the user and require confirmation. Either via a second LLM turn or a frontend confirmation dialog.
**Why:** LLM misinterpretation or fuzzy ETF matching could execute the wrong trade. No undo.

### 9. Set up frontend test framework (vitest)

**Priority:** Medium
**What:** Install vitest + @testing-library/react. Write initial tests for use-portfolios P&L calc and use-transactions hooks.
**Why:** Frontend has zero tests. P&L display bugs could mislead users.

## From Codex outside voice review (2026-03-30)

### 10. Validate chat session_id belongs to portfolio_id

**Priority:** High (security)
**What:** In `routers/chat.py` and `ChatAgent`, verify that the provided `session_id` actually belongs to the given `portfolio_id` before appending messages or loading history.
**Why:** Without this check, a request can mix portfolio A's context with portfolio B's chat history, and write messages into the wrong session.

### 11. Add row-level locking for concurrent trades

**Priority:** High (data integrity)
**What:** Add `SELECT ... FOR UPDATE` (or SQLAlchemy `with_for_update()`) when reading a position before modifying it in sell/buy operations. Also add a unique partial index: `CREATE UNIQUE INDEX ON positions (portfolio_id, etf_id) WHERE is_active = true`.
**Why:** Without locking, two concurrent buys can create duplicate active positions, and two concurrent sells can oversell the same holding.

### 12. Fix P&L calculation for rebuy cycles

**Priority:** High (correctness)
**What:** The `list_transactions` endpoint computes sell cost basis from `total_buys / total_buy_shares` across ALL buys in the position lifetime. This is wrong after a sell+rebuy cycle because earlier sells are not subtracted. Need FIFO or average-cost-per-remaining-share logic.
**Why:** Users see incorrect realized P&L in the transaction history after multiple sell/buy cycles.

### 13. Batch frontend quote + sparkline requests

**Priority:** Medium (performance)
**What:** The portfolio-tab fetches one quote per ETF and one price series per card for sparklines. A 25-position portfolio = 50+ requests. Create a batch endpoint (e.g., `/etfs/quotes?isins=...`) that returns all quotes in one request, and batch sparkline data similarly.
**Why:** Client-side request storm on every portfolio view.

## From /plan-ceo-review (2026-03-31, branch sc-27/ui-changes)

### 15. Theme filtering on portfolio tab

**Priority:** P2
**What:** Add theme/investment_focus field to ETFListItem and enable filter-by-theme on the portfolio card list.
**Why:** Users with 10+ ETFs across themes (AI, Gold, Defence) need to filter their view. Sorting alone isn't enough for thematic investors.
**Context:** `investment_focus` exists on `ETFDetailResponse` but not on `ETFListItem` or `PositionBrief`. Requires schema enrichment (migration or API join). Sorting by P&L/value/name is being added in the current sc-27 branch as groundwork.
**Effort:** M (human: ~4h / CC: ~15min)
**Depends on:** sc-27 branch merged (adds sort infrastructure)

### 16. Per-exchange market hours mapping

**Priority:** P3
**What:** Map exchange suffixes (.L, .DE, .PA, .AS, .MI, .SW) to their specific trading hours and timezones for accurate "market closed" detection.
**Why:** Current implementation uses simplified 08:00-17:30 CET for all exchanges. LSE operates in GMT/BST, Euronext Paris closes at 17:30 CET, etc.
**Context:** The simplified CET window works well enough for most cases. This is a polish item for accuracy.
**Effort:** S (human: ~2h / CC: ~5min)
**Depends on:** Market hours awareness feature in sc-27 branch

### 14. Chat buy should match API buy fidelity

**Priority:** Medium (consistency)
**What:** The `_open_trade` chat tool creates positions without theme assignment, layer label, or target allocation. The API `add_position` auto-classifies themes. Chat trades should go through the same service (once extracted per TODO #1) to maintain data fidelity.
**Why:** Charles creates lower-quality portfolio data than the regular UI. Positions opened via chat are missing theme categorization.
