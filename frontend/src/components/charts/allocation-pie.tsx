import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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

export function AllocationPie({ items }: Props) {
  if (items.length === 0) return null;

  const data = items.map((item, i) => ({
    name: item.ticker,
    value: Math.round(item.actual * 10) / 10,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <ResponsiveContainer width={180} height={180} className="shrink-0">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={46}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "6px", fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 sm:flex-col sm:gap-y-2 sm:pt-2">
        {items.map((item, i) => {
          const drift = item.target ? item.actual - item.target : null;
          const drifted = drift && Math.abs(drift) > 2;
          return (
            <div key={item.ticker} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
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
