import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Item {
  name: string;
  percentage: number | null;
}

interface Props {
  data: Item[];
  color?: string;
  title: string;
}

export function SectorCountryBar({ data, color = "#6366f1", title }: Props) {
  const sorted = [...data].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).slice(0, 10);

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={sorted.length * 28 + 20}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 80, right: 20 }}>
          <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 11, fill: "#a1a1aa" }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} width={75} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a" }} />
          <Bar dataKey="percentage" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
