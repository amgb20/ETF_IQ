import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface AllocationItem {
  ticker: string;
  actual: number;
  target: number | null;
}

interface Props {
  items: AllocationItem[];
}

export function AllocationBar({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={48}>
        <BarChart data={[{ name: "alloc", ...Object.fromEntries(items.map((i) => [i.ticker, i.actual])) }]} layout="horizontal" barSize={32}>
          <XAxis type="category" dataKey="name" hide />
          <YAxis type="number" hide domain={[0, 100]} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }} />
          {items.map((item, i) => (
            <Bar key={item.ticker} dataKey={item.ticker} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const drift = item.target ? item.actual - item.target : null;
          const drifted = drift && Math.abs(drift) > 2;
          return (
            <div key={item.ticker} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="font-medium">{item.ticker}</span>
              <span className="text-muted-foreground">{item.actual.toFixed(1)}%</span>
              {drifted && <Badge variant="warning" className="text-[10px] px-1 py-0">{drift! > 0 ? "+" : ""}{drift!.toFixed(1)}%</Badge>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
