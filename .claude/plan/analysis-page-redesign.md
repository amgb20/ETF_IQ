# Implementation Plan: Analysis Page Redesign

## Task Type

- [x] Frontend (primary — component restructure, styling, interactions)
- [x] Backend (minor — new API fields: volume, YTD return, dividend yield, TER in quote endpoint)
- [x] Fullstack

## Summary

Redesign the `/analysis` page from a 5-tab layout to a 4-tab layout, merging Quote + Positions into a unified "Portfolio" view. ETF cards blend with the cream background, show mini sparklines, inline P&L, and all key investor metrics. Clicking a card opens a centered modal with full ETF detail. Chart workspace gets a Growth % / Live Price toggle.

## Design Decisions (from grill-me session)

| Decision            | Answer                                                             |
| ------------------- | ------------------------------------------------------------------ |
| Chart style         | Both: mini sparkline per card + full chart growth/price toggle     |
| Default chart range | 1 Day (intraday)                                                   |
| Extra metrics       | Volume, YTD return %, Dividend yield, TER — all visible by default |
| Tab structure       | Merge Quote + Positions → "Portfolio" tab                          |
| P&L display         | Inline in each card + total portfolio summary bar at top           |
| Sparkline period    | 1 month                                                            |
| Card style          | Blend with background (no white bg-card)                           |
| Card click          | Centered modal with backdrop blur showing full ETF detail          |
| Trade actions       | In the card's ... menu (Buy more, Sell, Set alert, View details)   |
| Data density        | All 4 new metrics visible by default                               |

---

## Implementation Steps

### Step 1: Backend — Extend Quote Endpoint

**File:** `unified-api/app/routers/etfs.py` (quote endpoint)

Add to `QuoteData` response:

- `volume: int | None` — daily trading volume
- `ytd_return_pct: float | None` — year-to-date return percentage
- `dividend_yield: float | None` — trailing 12-month dividend yield
- `ter: float | None` — total expense ratio

Source: yfinance already provides `volume`, `ytdReturn` (or calculate from Jan 1 close), and we can pull `trailingAnnualDividendYield` from `info`. TER may come from JustETF data or the ETF detail table.

**Deliverable:** Updated `/etfs/{isin}/quote` returning 4 new fields.

---

### Step 2: Frontend Types — Update QuoteData Interface

**File:** `frontend/src/hooks/use-etfs.ts`

Add to `QuoteData` interface:

```typescript
volume: number | null;
ytd_return_pct: number | null;
dividend_yield: number | null;
ter: number | null;
```

**Deliverable:** Updated TypeScript type matching backend.

---

### Step 3: Portfolio Summary Bar Component

**File:** `frontend/src/components/analysis/portfolio-summary-bar.tsx` (NEW)

A sticky horizontal bar at the top of the Portfolio tab showing:

- Total portfolio value (sum of current_value across positions)
- Total unrealized P&L (value + %)
- Total day change (sum of day_change \* shares across positions)

Layout: 3 columns, centered, blends with background. Numbers are large, color-coded (green/red).

**Deliverable:** New `<PortfolioSummaryBar>` component.

---

### Step 4: Mini Sparkline Component

**File:** `frontend/src/components/charts/mini-sparkline.tsx` (NEW)

A tiny inline SVG chart (80px wide x 32px tall) showing 1-month price trend.

- Uses the existing `/prices?etf_id={}&from={}` endpoint (30 days back)
- Line color: green if last > first, red if last < first
- No axes, labels, or tooltips — just the line
- Renders as a simple SVG `<polyline>` (no heavy chart library)

**Deliverable:** New `<MiniSparkline etfId={} />` component.

---

### Step 5: ETF Portfolio Card Component

**File:** `frontend/src/components/analysis/portfolio-card.tsx` (NEW)

Replace the current `QuoteTab` grid cards with new merged cards:

```
┌──────────────────────────────────────────────────┐
│ SMGB.L   ·  iShares MSCI Gold    [sparkline] ... │
│ 42.85  +0.32 (+0.75%)                            │
│                                                   │
│ Position: 150 shares @ 38.20  P&L: +693.00 (+12%)│
│                                                   │
│ Vol: 1.2M  YTD: +8.3%  Yield: 0.0%  TER: 0.12% │
│ ──────── 52W Range ────────  [====|======]        │
└──────────────────────────────────────────────────┘
```

- No `bg-card` — blends with background, separated by border-bottom
- `...` menu: Buy more, Sell, Set alert, View details
- Click anywhere (except ...) → opens ETF detail modal
- Sparkline from Step 4
- All 4 new metrics inline

**Deliverable:** New `<PortfolioCard>` component.

---

### Step 6: ETF Detail Modal

**File:** `frontend/src/components/analysis/etf-detail-modal.tsx` (NEW)

Centered modal (`Dialog` from Radix/shadcn) with backdrop blur:

- Reuses content from existing `etf-detail-tab.tsx` (fund info, risk, holdings, allocations)
- `DialogOverlay` with `backdrop-blur-sm bg-background/60`
- Scrollable content area inside
- Close via X button or clicking outside

**Deliverable:** New `<ETFDetailModal isin={} open={} onClose={} />`.

---

### Step 7: Rewrite Quote Tab → Portfolio Tab

**File:** `frontend/src/components/analysis/quote-tab.tsx` → rename to `portfolio-tab.tsx`

Replace the current grid of simple quote cards with:

1. `<PortfolioSummaryBar>` at top
2. Filter indicator: "Showing X of Y positions" when chart ETF toggles filter the list (appears only when filtered, uses `text-xs text-muted-foreground`)
3. List of `<PortfolioCard>` (one per position, blending with background)
4. `<ETFDetailModal>` triggered by card click
5. `<SellModal>` triggered by ... menu → Sell

**Deliverable:** Rewritten tab component with merged quote + position data.

---

### Step 8: Chart Workspace — Growth/Price Toggle

**File:** `frontend/src/components/analysis/chart-workspace.tsx`

Add a toggle button in the chart toolbar: **Growth %** | **Price**

- Growth % mode: current behavior (normalized percentage from base)
- Price mode: raw price values on Y-axis
- Default: Growth % (unchanged)
- Toggle state stored in component state
- Pass mode to `<AnalysisChart>` which adjusts Y-axis formatting

Also: change default time range from `"1Y"` to `"1D"`.

**Market closed behavior:** When 1D is selected and the intraday data has fewer than 5 data points (market closed/weekend), show a banner above the chart: "Market closed — showing last session's data" in `text-xs text-muted-foreground` with a subtle `bg-muted/50` background. Display the last closing time. The chart still renders the last available 1D data.

**Deliverable:** New toggle in chart toolbar + default range change + market closed banner.

---

### Step 9: Update Analysis Page Tabs

**File:** `frontend/src/pages/analysis.tsx`

- Remove "Quote" tab → replace with "Portfolio" (uses new `portfolio-tab.tsx`)
- Remove "Positions" tab (merged into Portfolio)
- Keep: ETF Detail, Agent Reports, Alerts
- Tab order: Portfolio (default), ETF Detail, Agent Reports, Alerts
- Update URL routing accordingly

**Deliverable:** 4-tab layout instead of 5.

---

### Step 10: Card Menu Actions Integration

**File:** `frontend/src/components/analysis/portfolio-card.tsx`

Wire all 4 actions in the card's `...` menu:

- **View details** → opens ETF detail modal (already working)
- **Sell** → opens existing `SellModal` with the selected position
- **Buy more** → opens existing `AddPositionModal` pre-filled with the ETF's ISIN
- **Set alert** → navigates to Alerts tab with the ETF pre-selected (or opens an inline alert creation form)

All 4 buttons enabled. No disabled states without explanation.

**Deliverable:** All card menu actions functional.

---

## Key Files

| File                                                         | Operation                     | Description                                                       |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------- |
| `unified-api/app/routers/etfs.py`                            | Modify                        | Add volume, ytd_return_pct, dividend_yield, ter to quote endpoint |
| `frontend/src/hooks/use-etfs.ts`                             | Modify                        | Update QuoteData interface                                        |
| `frontend/src/components/analysis/portfolio-summary-bar.tsx` | Create                        | Portfolio total value/P&L bar                                     |
| `frontend/src/components/charts/mini-sparkline.tsx`          | Create                        | Tiny inline SVG sparkline                                         |
| `frontend/src/components/analysis/portfolio-card.tsx`        | Create                        | Merged quote+position ETF card                                    |
| `frontend/src/components/analysis/etf-detail-modal.tsx`      | Create                        | Centered detail modal with blur                                   |
| `frontend/src/components/analysis/quote-tab.tsx`             | Rewrite → `portfolio-tab.tsx` | Merged Portfolio tab                                              |
| `frontend/src/components/analysis/chart-workspace.tsx`       | Modify                        | Add Growth/Price toggle, default 1D                               |
| `frontend/src/pages/analysis.tsx`                            | Modify                        | 4 tabs instead of 5                                               |

## Interaction States

| Component           | Loading                       | Empty                                                 | Error                                                                        | Partial                                    |
| ------------------- | ----------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| PortfolioSummaryBar | 3 skeleton blocks (h-14 w-48) | Shows zeros                                           | N/A (derived from card data)                                                 | Shows available totals                     |
| PortfolioCard       | Full-card skeleton (h-36)     | N/A                                                   | Subtle error icon + "Data unavailable" text + retry button; dash values stay | Shows available fields, dashes for missing |
| MiniSparkline       | Empty placeholder div (80x32) | Empty div (fewer than 2 data points)                  | Empty div (silent fail)                                                      | N/A                                        |
| ETFDetailModal      | Skeleton blocks inside modal  | "Could not load ETF details." centered message        | Same as empty                                                                | N/A                                        |
| Quote data fetch    | Skeleton card list            | "No active positions. Add ETFs..." with centered text | Per-card error indicator (see above)                                         | Cards load individually as data arrives    |
| Chart workspace     | Skeleton chart area           | "Select ETFs to chart" message                        | "Chart data unavailable" banner with retry                                   | Shows available ETFs, grays out failed     |

**Data freshness indicator:** Each portfolio card shows a subtle "as of HH:MM" timestamp in `text-[10px] text-muted-foreground` below the metrics row. This uses the quote's `last_updated` field. When quote data fails to load, show a warning icon (AlertTriangle, 12px) with tooltip "Quote unavailable — click to retry".

## Risks and Mitigation

| Risk                                                        | Mitigation                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Quote endpoint may not have volume/YTD/yield from yfinance  | Fallback to null; check yfinance `info` dict for available fields                 |
| TER not in yfinance                                         | Pull from existing `etf_detail` table or JustETF connector data                   |
| Mini sparkline causes N extra API calls (one per ETF)       | Use React Query caching; 30-day price data is already cached from chart workspace |
| Sell modal state management with new card layout            | Reuse existing `SellModal` component, just change trigger location                |
| Intraday default (1D) may have no data outside market hours | Show "Market closed" message with last available data                             |

### Step 0: Create DESIGN.md (Pre-requisite)

**File:** `DESIGN.md` (NEW, project root)

Document the existing design system extracted from `frontend/src/index.css`:

- **Colors**: Dark default (#0A0A0F bg, #f0ede6 fg), Light/cream (#F5F0E8 bg, #1A1A1A fg), Gold primary (#C9A84C), Cyan accent (#00D4FF)
- **Semantic colors**: positive (#22c55e), negative (#ef4444), warning (#f59e0b), info (#3b82f6)
- **Typography**: Inter 300-700, tabular-nums for all financial numbers
- **Spacing**: Tailwind default scale, consistent py-4/py-5 for card padding
- **Components**: shadcn/Radix (Dialog, Popover, Tabs, Button, Badge, Skeleton)
- **Patterns**: `divide-y divide-border/40` for list separation, no card backgrounds for blending items, `text-positive`/`text-negative` for gain/loss
- **Chart colors**: 7-color palette (indigo, green, amber, red, violet, cyan, pink)
- **Border radius**: 0.375rem default, `rounded-xl` for popovers

**Deliverable:** Single source of truth for all design decisions. New components reference this instead of guessing.

## Build Sequence

```
Step 0 (DESIGN.md) → Step 1 (Backend) → Step 2 (Types) → Steps 3-6 (parallel)
→ Step 7 (compose Portfolio tab) → Step 8 (chart toggle)
→ Step 9 (wire into page) → Step 10 (sell integration)
→ TypeScript check → Build verify
```

## Responsive Design

### Mobile (< 640px / `sm` breakpoint)

- **PortfolioSummaryBar**: Stack vertically (`flex-col gap-2`), left-align all values, full width. Portfolio value first, P&L second, day change third.
- **PortfolioCard**: Metrics row wraps to 2x2 grid (`grid grid-cols-2 gap-2`). Sparkline moves below ticker/name row. Touch target for `...` menu enlarged to 44px (`p-3`).
- **Chart workspace**: Chart mode tabs scroll horizontally (`overflow-x-auto`). Time range + interval controls stay as horizontal scroll. ETF toggle buttons wrap naturally.
- **ETF Detail Modal**: Full-screen on mobile (`max-w-full h-full sm:max-w-2xl sm:h-auto`). Scrollable content.
- **52W Range bar**: Full width, no change needed.

### Tablet (640px - 1024px / `sm` to `lg`)

- **PortfolioSummaryBar**: 3-column layout (as desktop).
- **PortfolioCard**: Metrics stay in single row. Sparkline stays inline.
- **Chart workspace**: All controls visible, no collapse needed.

### Accessibility

- **Sparkline SVG**: Add `role="img"` and `aria-label="1-month price trend, [up/down] X%"`.
- **Touch targets**: All interactive elements minimum 44px touch target on mobile (apply via `min-h-11 min-w-11`).
- **Keyboard**: Tab order: summary bar → first card → card menu → next card. Enter opens detail modal. Escape closes modal.
- **Color contrast**: Positive green (#22c55e) and negative red (#ef4444) both pass WCAG AA against both dark (#0A0A0F) and light (#F5F0E8) backgrounds.
- **Screen readers**: `aria-live="polite"` on summary bar values for real-time P&L updates. `sr-only` labels on icon-only buttons.

## SESSION_ID

- CODEX_SESSION: N/A (context gathered directly by Claude)
- GEMINI_SESSION: N/A (context gathered directly by Claude)

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status        | Findings                  |
| ------------- | --------------------- | ------------------------------- | ---- | ------------- | ------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —             | —                         |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —             | —                         |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | ISSUES (PLAN) | 14 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —             | —                         |

- **OUTSIDE VOICE:** Codex found 6 issues (session trust bypass, concurrent trade race, P&L calc bug on rebuy, hardwired first-portfolio, client request storm, chat buy fidelity gap)
- **CROSS-MODEL:** 5 of 6 codex findings were new (not caught by eng review). User accepted all as TODOs but chose to keep chat trade execution.
- **UNRESOLVED:** 0 decisions unresolved. All 14 TODOs captured in TODOS.md.
- **VERDICT:** ENG REVIEW complete with issues. Fix high-priority TODOs #1-3 and #10-12 before shipping.
