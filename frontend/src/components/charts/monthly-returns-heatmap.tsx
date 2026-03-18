import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UseQueryResult } from "@tanstack/react-query";
import type { PriceSeries } from "@/hooks/use-prices";
import type { ETFListItem } from "@/hooks/use-etfs";
import { tickerLabel } from "@/lib/constants";

interface Props {
  priceQueries: UseQueryResult<PriceSeries, Error>[];
  etfs: ETFListItem[];
  loading?: boolean;
}

interface MonthlyReturn {
  key: string;   // "MM/YY"
  value: number;  // percentage
}

function returnColor(val: number): string {
  if (val >= 15) return "bg-green-600/90 text-white";
  if (val >= 10) return "bg-green-600/70 text-white";
  if (val >= 5) return "bg-green-600/50 text-zinc-100";
  if (val >= 2) return "bg-green-600/30 text-zinc-100";
  if (val >= 0) return "bg-green-600/15 text-zinc-200";
  if (val >= -2) return "bg-red-600/15 text-zinc-200";
  if (val >= -5) return "bg-red-600/30 text-zinc-100";
  if (val >= -10) return "bg-red-600/50 text-zinc-100";
  if (val >= -15) return "bg-red-600/70 text-white";
  return "bg-red-600/90 text-white";
}

function computeMonthlyReturns(prices: { date: string; close: number }[]): MonthlyReturn[] {
  if (prices.length < 2) return [];

  const byMonth = new Map<string, { first: number; last: number }>();

  for (const p of prices) {
    const d = new Date(p.date);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
    const existing = byMonth.get(key);
    if (!existing) {
      byMonth.set(key, { first: p.close, last: p.close });
    } else {
      existing.last = p.close;
    }
  }

  const results: MonthlyReturn[] = [];
  for (const [key, { first, last }] of byMonth) {
    if (first > 0) {
      results.push({ key, value: ((last - first) / first) * 100 });
    }
  }
  return results;
}

export function MonthlyReturnsHeatmap({ priceQueries, etfs, loading }: Props) {
  const data = useMemo(() => {
    const rows: { label: string; returns: Map<string, number> }[] = [];
    const allMonths = new Set<string>();

    for (let i = 0; i < etfs.length; i++) {
      const q = priceQueries[i];
      if (!q?.data?.prices?.length) continue;

      const label = tickerLabel(etfs[i].ticker_yf, etfs[i].isin);
      const monthly = computeMonthlyReturns(
        q.data.prices.map((p) => ({ date: p.date, close: p.close })),
      );

      const returnMap = new Map<string, number>();
      for (const m of monthly) {
        returnMap.set(m.key, m.value);
        allMonths.add(m.key);
      }
      rows.push({ label, returns: returnMap });
    }

    const sortedMonths = [...allMonths].sort((a, b) => {
      const [am, ay] = a.split("/").map(Number);
      const [bm, by] = b.split("/").map(Number);
      if (by !== ay) return by - ay;
      return bm - am;
    });

    return { rows, months: sortedMonths };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceQueries.map((q) => q.dataUpdatedAt).join(","), etfs]);

  if (loading) return <Skeleton className="h-[400px] w-full rounded-xl" />;

  if (data.rows.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Select ETFs with price history to display the monthly returns heatmap.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background p-2 text-left font-medium text-muted-foreground min-w-[120px]" />
            {data.months.map((m) => (
              <th key={m} className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[64px]">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.label}>
              <td className="sticky left-0 z-10 bg-background p-2 font-medium text-muted-foreground whitespace-nowrap">
                {row.label}
              </td>
              {data.months.map((m) => {
                const val = row.returns.get(m);
                if (val == null) {
                  return (
                    <td key={m} className="p-2 text-center text-muted-foreground">
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={m}
                    className={`p-2 text-center font-mono tabular-nums ${returnColor(val)}`}
                  >
                    {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-center gap-1 py-3 text-[10px] text-muted-foreground">
        <span className="inline-block h-3 w-6 rounded bg-red-600/90" /> &lt;-15%
        <span className="inline-block h-3 w-6 rounded bg-red-600/30 ml-1" /> -5%
        <span className="inline-block h-3 w-6 rounded bg-zinc-700/30 ml-1" /> 0%
        <span className="inline-block h-3 w-6 rounded bg-green-600/30 ml-1" /> +5%
        <span className="inline-block h-3 w-6 rounded bg-green-600/90 ml-1" /> &gt;+15%
      </div>
    </div>
  );
}
