import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell,
} from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { ETFRiskMetric } from "@/hooks/use-etfs";

interface Props {
  metrics?: ETFRiskMetric[];
  loading?: boolean;
}

export function RiskReturnChart({ metrics, loading }: Props) {
  if (loading) return <Skeleton className="h-[400px] w-full rounded-xl" />;

  const data = (metrics ?? [])
    .filter((m) => m.annualized_volatility != null && m.annualized_return != null)
    .map((m) => ({
      name: m.ticker_yf?.replace(".L", "") ?? m.isin.slice(0, 6),
      volatility: m.annualized_volatility!,
      returnPct: m.annualized_return!,
      isin: m.isin,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          Not enough price data to compute risk-return metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl">
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
          <XAxis
            type="number"
            dataKey="volatility"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={{ stroke: "#27272a" }}
          >
            <Label
              value="Annualized Volatility (%)"
              position="bottom"
              offset={10}
              style={{ fill: "#71717a", fontSize: 12 }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="returnPct"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={{ stroke: "#27272a" }}
          >
            <Label
              value="Annualized Return (%)"
              angle={-90}
              position="insideLeft"
              offset={0}
              style={{ fill: "#71717a", fontSize: 12 }}
            />
          </YAxis>
          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name === "returnPct" ? "Return" : "Volatility"]}
            labelFormatter={(_, payload) => payload[0]?.payload?.name ?? ""}
          />
          <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
          <Scatter data={data} fill="#6366f1">
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map((d, i) => (
          <div key={d.isin} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
