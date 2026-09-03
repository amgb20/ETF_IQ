import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { subDays, format } from "date-fns";
import type { PriceSeries } from "@/hooks/use-prices";

interface Props {
  etfId: string;
  width?: number;
  height?: number;
}

export function MiniSparkline({ etfId, width = 80, height = 32 }: Props) {
  const from = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const { data } = useQuery<PriceSeries>({
    queryKey: ["prices-sparkline", etfId],
    queryFn: () => apiFetch(`/prices?etf_id=${etfId}&from=${from}`),
    enabled: !!etfId,
    staleTime: 5 * 60_000,
  });

  const prices = data?.prices ?? [];
  if (prices.length < 2) return <div style={{ width, height }} />;

  const closes = prices.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = closes
    .map((c, i) => {
      const x = padding + (i / (closes.length - 1)) * innerW;
      const y = padding + (1 - (c - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const trending = closes[closes.length - 1] >= closes[0];
  const color = trending ? "var(--color-positive)" : "var(--color-negative)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
