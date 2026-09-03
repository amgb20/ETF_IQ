import { cn } from "@/lib/utils";
import type { PositionBrief } from "@/hooks/use-portfolios";
import type { QuoteData } from "@/hooks/use-etfs";

interface Props {
  positions: PositionBrief[];
  quotes: Map<string, QuoteData>;
}

function formatCurrency(v: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PortfolioSummaryBar({ positions, quotes }: Props) {
  let totalValue = 0;
  let totalCost = 0;
  let totalDayChange = 0;

  for (const p of positions) {
    totalValue += p.current_value ?? 0;
    totalCost += p.shares * p.entry_price;

    const q = quotes.get(p.etf_isin);
    if (q?.day_change != null) {
      totalDayChange += q.day_change * p.shares;
    }
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dayPct =
    totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;
  const pnlPositive = totalPnl >= 0;
  const dayPositive = totalDayChange >= 0;

  return (
    <div className="flex items-center justify-between gap-6 py-4 mb-2">
      <div>
        <p className="text-xs text-muted-foreground">Portfolio Value</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCurrency(totalValue)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Unrealized P&L</p>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            pnlPositive ? "text-positive" : "text-negative"
          )}
        >
          {pnlPositive ? "+" : ""}
          {formatCurrency(totalPnl)}
          <span className="text-sm ml-1">
            ({pnlPositive ? "+" : ""}
            {totalPnlPct.toFixed(1)}%)
          </span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Day Change</p>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            dayPositive ? "text-positive" : "text-negative"
          )}
        >
          {dayPositive ? "+" : ""}
          {formatCurrency(totalDayChange)}
          <span className="text-sm ml-1">
            ({dayPositive ? "+" : ""}
            {dayPct.toFixed(2)}%)
          </span>
        </p>
      </div>
    </div>
  );
}
