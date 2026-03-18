import { useEffect, useRef } from "react";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";
import { Skeleton } from "@/components/ui/skeleton";

interface DataPoint {
  time: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  loading?: boolean;
  entryDate?: string;
  entryPrice?: number;
}

export function PortfolioValueChart({ data, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8a8a9a",
      },
      grid: {
        vertLines: { color: "#23201a" },
        horzLines: { color: "#23201a" },
      },
      width: containerRef.current.clientWidth,
      height: 350,
      timeScale: { borderColor: "#23201a" },
      rightPriceScale: { borderColor: "#23201a" },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#6366f1",
      topColor: "rgba(99,102,241,0.4)",
      bottomColor: "rgba(99,102,241,0.0)",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesRef.current.setData(data as any);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  if (loading) return <Skeleton className="h-[350px] w-full rounded-xl" />;

  return <div ref={containerRef} className="w-full rounded-xl" />;
}
