import { useState } from "react";
import {
  MoreHorizontal,
  ShoppingCart,
  TrendingDown,
  Bell,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { tickerLabel } from "@/lib/constants";
import type { PositionBrief } from "@/hooks/use-portfolios";
import type { QuoteData } from "@/hooks/use-etfs";

interface Props {
  position: PositionBrief;
  quote: QuoteData | undefined;
  onClick: () => void;
  onSell: () => void;
}

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "\u2014";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVol(v: number | null): string {
  if (v == null) return "\u2014";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

function W52Bar({
  low,
  high,
  current,
}: {
  low: number | null;
  high: number | null;
  current: number | null;
}) {
  if (low == null || high == null || current == null) return null;
  const range = high - low;
  if (range <= 0) return null;
  const pct = Math.min(Math.max(((current - low) / range) * 100, 0), 100);

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{fmt(low, 2)}</span>
        <span>52-Week Range</span>
        <span>{fmt(high, 2)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-border">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/30"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full bg-foreground shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PortfolioCard({ position, quote, onClick, onSell }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ticker = tickerLabel(position.ticker_yf, position.etf_isin);
  const positive = (quote?.day_change ?? 0) >= 0;
  const pnlPositive = (position.pnl ?? 0) >= 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      className="border-b border-border/40 py-5 cursor-pointer hover:bg-muted/30 transition-colors group"
    >
      {/* Row 1: Ticker + Name + Sparkline + Menu */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{ticker}</span>
            <span className="text-xs text-muted-foreground truncate">
              {position.etf_name}
            </span>
          </div>
        </div>
        <MiniSparkline etfId={position.etf_id} />
        <div onClick={(e) => e.stopPropagation()}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 sidebar-transition">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={4}
              className="w-40 p-1 rounded-xl"
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onClick();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-secondary/60 sidebar-transition"
              >
                <Eye className="h-3 w-3" /> View details
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onSell();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs hover:bg-secondary/60 sidebar-transition"
              >
                <TrendingDown className="h-3 w-3" /> Sell
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60 sidebar-transition"
                disabled
              >
                <ShoppingCart className="h-3 w-3" /> Buy more
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/60 sidebar-transition"
                disabled
              >
                <Bell className="h-3 w-3" /> Set alert
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Row 2: Price + Day change */}
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-xl font-semibold tabular-nums">
          {fmt(quote?.last_close ?? null)}
        </span>
        {quote?.day_change != null && (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              positive ? "text-positive" : "text-negative"
            )}
          >
            {positive ? "+" : ""}
            {quote.day_change.toFixed(2)} ({positive ? "+" : ""}
            {quote.day_change_pct?.toFixed(2) ?? "\u2014"}%)
          </span>
        )}
      </div>

      {/* Row 3: Position P&L */}
      <div className="flex items-center gap-4 text-xs mb-3">
        <span className="text-muted-foreground">
          {position.shares} shares @ {fmt(position.entry_price)}
        </span>
        <span
          className={cn(
            "font-medium tabular-nums",
            pnlPositive ? "text-positive" : "text-negative"
          )}
        >
          P&L: {pnlPositive ? "+" : ""}
          {fmt(position.pnl ?? null)}
          {position.pnl_pct != null && (
            <span className="ml-0.5">
              ({pnlPositive ? "+" : ""}
              {position.pnl_pct.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>

      {/* Row 4: Metrics */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Vol:{" "}
          <span className="font-medium text-foreground/80">
            {fmtVol(quote?.volume ?? null)}
          </span>
        </span>
        <span>
          YTD:{" "}
          <span
            className={cn(
              "font-medium",
              (quote?.ytd_return_pct ?? 0) >= 0
                ? "text-positive"
                : "text-negative"
            )}
          >
            {quote?.ytd_return_pct != null
              ? `${quote.ytd_return_pct >= 0 ? "+" : ""}${quote.ytd_return_pct.toFixed(1)}%`
              : "\u2014"}
          </span>
        </span>
        <span>
          Yield:{" "}
          <span className="font-medium text-foreground/80">
            {quote?.dividend_yield != null
              ? `${(quote.dividend_yield * 100).toFixed(1)}%`
              : "\u2014"}
          </span>
        </span>
        <span>
          TER:{" "}
          <span className="font-medium text-foreground/80">
            {quote?.ter != null ? `${(quote.ter * 100).toFixed(2)}%` : "\u2014"}
          </span>
        </span>
      </div>

      {/* Row 5: 52W Range */}
      <W52Bar
        low={quote?.week_52_low ?? null}
        high={quote?.week_52_high ?? null}
        current={quote?.last_close ?? null}
      />
    </div>
  );
}
