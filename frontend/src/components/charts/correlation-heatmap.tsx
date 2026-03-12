import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ETFRiskMetric } from "@/hooks/use-etfs";

interface Props {
  correlation?: Record<string, Record<string, number>>;
  etfs?: ETFRiskMetric[];
  loading?: boolean;
}

function corrColor(val: number): string {
  if (val >= 0.8) return "bg-green-600/80";
  if (val >= 0.5) return "bg-green-600/50";
  if (val >= 0.2) return "bg-green-600/25";
  if (val >= -0.2) return "bg-zinc-700/50";
  if (val >= -0.5) return "bg-red-600/25";
  if (val >= -0.8) return "bg-red-600/50";
  return "bg-red-600/80";
}

export function CorrelationHeatmap({ correlation, etfs, loading }: Props) {
  if (loading) return <Skeleton className="h-[400px] w-full rounded-xl" />;

  const labels = useMemo(() => {
    if (!etfs) return [];
    return etfs.map((e) => ({
      isin: e.isin,
      label: e.ticker_yf?.replace(".L", "") ?? e.isin.slice(0, 6),
    }));
  }, [etfs]);

  if (!correlation || labels.length < 2) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Not enough data to compute correlations. Need at least 2 ETFs with price history.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-muted-foreground" />
            {labels.map((l) => (
              <th key={l.isin} className="p-2 text-center font-medium text-muted-foreground whitespace-nowrap">
                {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((row) => (
            <tr key={row.isin}>
              <td className="p-2 font-medium text-muted-foreground whitespace-nowrap">{row.label}</td>
              {labels.map((col) => {
                const val = correlation[row.isin]?.[col.isin] ?? correlation[col.isin]?.[row.isin];
                const display = val != null ? val.toFixed(2) : "—";
                const isDiagonal = row.isin === col.isin;
                return (
                  <td
                    key={col.isin}
                    className={`p-2 text-center font-mono tabular-nums ${isDiagonal ? "bg-zinc-800/60 text-zinc-400" : corrColor(val ?? 0) + " text-zinc-100"}`}
                  >
                    {isDiagonal ? "1.00" : display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-center gap-1 py-3 text-[10px] text-muted-foreground">
        <span className="inline-block h-3 w-6 rounded bg-red-600/80" /> -1.0
        <span className="inline-block h-3 w-6 rounded bg-red-600/25 ml-1" /> -0.5
        <span className="inline-block h-3 w-6 rounded bg-zinc-700/50 ml-1" /> 0.0
        <span className="inline-block h-3 w-6 rounded bg-green-600/25 ml-1" /> +0.5
        <span className="inline-block h-3 w-6 rounded bg-green-600/80 ml-1" /> +1.0
      </div>
    </div>
  );
}
