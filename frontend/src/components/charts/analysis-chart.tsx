import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, LineSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type SeriesMarker, type Time, ColorType } from "lightweight-charts";
import { CHART_COLORS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { EventTooltip } from "@/components/analysis/event-tooltip";
import type { ChartEvent } from "@/hooks/use-events";

interface SeriesData {
  label: string;
  data: { time: string; value: number }[];
}

interface Props {
  series: SeriesData[];
  loading?: boolean;
  chartType?: "line" | "bar";
  events?: ChartEvent[];
}

function eventToMarker(event: ChartEvent): SeriesMarker<Time> {
  const isPositive = event.sentiment === "positive";
  const isNegative = event.sentiment === "negative";

  return {
    time: event.event_date as Time,
    position: isNegative ? "belowBar" : "aboveBar",
    color: isPositive ? "#22c55e" : isNegative ? "#ef4444" : "#a1a1aa",
    shape: isPositive ? "arrowUp" : isNegative ? "arrowDown" : "circle",
    text: event.headline.length > 30 ? event.headline.slice(0, 27) + "..." : event.headline,
  };
}

export function AnalysisChart({ series, loading, chartType = "line", events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const [tooltip, setTooltip] = useState<{ event: ChartEvent; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: { borderColor: "#27272a" },
      rightPriceScale: { borderColor: "#27272a" },
    });
    chartRef.current = chart;

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
    const chart = chartRef.current;
    if (!chart) return;

    seriesRefs.current.forEach((s) => chart.removeSeries(s));
    seriesRefs.current = [];

    series.forEach((s, i) => {
      const line = chart.addSeries(LineSeries, {
        color: CHART_COLORS[i % CHART_COLORS.length],
        lineWidth: 2,
        title: s.label,
      });
      line.setData(s.data as any);

      if (events?.length) {
        const seriesLabel = s.label;
        const relevantEvents = events.filter((ev) =>
          ev.tickers.some(
            (t) =>
              t === seriesLabel ||
              t.replace(".L", "") === seriesLabel,
          ),
        );
        if (relevantEvents.length > 0) {
          const markers = relevantEvents
            .map(eventToMarker)
            .sort((a, b) => (a.time as string).localeCompare(b.time as string));
          createSeriesMarkers(line, markers);
        }
      }

      seriesRefs.current.push(line);
    });

    chart.timeScale().fitContent();
  }, [series, chartType, events]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!events?.length || !chartRef.current || !containerRef.current) {
        setTooltip(null);
        return;
      }

      const chart = chartRef.current;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const param = chart.timeScale().coordinateToLogical(x);
      if (param == null) {
        setTooltip(null);
        return;
      }

      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      if (!visibleRange) {
        setTooltip(null);
        return;
      }

      const timeCoord = chart.timeScale().logicalToCoordinate(param);
      if (timeCoord == null) {
        setTooltip(null);
        return;
      }

      const closest = events.reduce<ChartEvent | null>((best, ev) => {
        const evCoord = chart.timeScale().timeToCoordinate(ev.event_date as Time);
        if (evCoord == null) return best;
        const dist = Math.abs(evCoord - x);
        if (dist < 20) {
          if (!best) return ev;
          const bestCoord = chart.timeScale().timeToCoordinate(best.event_date as Time);
          if (bestCoord == null) return ev;
          return dist < Math.abs(bestCoord - x) ? ev : best;
        }
        return best;
      }, null);

      if (closest) {
        setTooltip({ event: closest, x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setTooltip(null);
      }
    },
    [events],
  );

  if (loading) return <Skeleton className="h-[400px] w-full rounded-xl" />;

  return (
    <div className="relative w-full rounded-xl" onClick={handleClick}>
      <div ref={containerRef} className="w-full rounded-xl" />
      {tooltip && (
        <div
          className="absolute z-50"
          style={{ left: tooltip.x, top: tooltip.y - 10, transform: "translateX(-50%) translateY(-100%)" }}
        >
          <EventTooltip event={tooltip.event} />
        </div>
      )}
    </div>
  );
}
