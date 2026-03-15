import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  ColorType,
} from "lightweight-charts";
import { CHART_COLORS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { EventPinnedCard } from "@/components/analysis/event-tooltip";
import type { ChartEvent } from "@/hooks/use-events";

interface SeriesData {
  label: string;
  data: { time: string; value: number }[];
}

interface Props {
  series: SeriesData[];
  loading?: boolean;
  chartType?: "line" | "bar" | "drawdown";
  events?: ChartEvent[];
}

const CHART_HEIGHT = 400;

export function AnalysisChart({ series, loading, chartType = "line", events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<any>[]>([]);

  const [pinnedCard, setPinnedCard] = useState<{
    events: ChartEvent[];
    x: number;
    y: number;
  } | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ChartEvent[]>();
    if (!events?.length) return map;
    for (const ev of events) {
      const existing = map.get(ev.event_date) ?? [];
      existing.push(ev);
      map.set(ev.event_date, existing);
    }
    return map;
  }, [events]);

  // Maps the visual (possibly snapped) marker date → events, so clicks resolve correctly
  // even when event dates are beyond the price data range.
  const clickMapRef = useRef(new Map<string, ChartEvent[]>());

  // ── Create chart ────────────────────────────────────────────────────────
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
      height: CHART_HEIGHT,
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
      seriesRefs.current = [];
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // ── Populate series + consolidated markers (one per date/series/sentiment) ─
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const s of seriesRefs.current) {
      try { chart.removeSeries(s); } catch { /* already gone */ }
    }
    seriesRefs.current = [];

    const placedGroups = new Set<string>();
    const clickMap = new Map<string, ChartEvent[]>();

    series.forEach((s, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length];
      let seriesApi: ISeriesApi<any>;

      if (chartType === "bar") {
        seriesApi = chart.addSeries(HistogramSeries, {
          color,
          title: s.label,
        });
      } else if (chartType === "drawdown") {
        seriesApi = chart.addSeries(AreaSeries, {
          lineColor: color,
          topColor: `${color}33`,
          bottomColor: `${color}11`,
          lineWidth: 2,
          title: s.label,
        });
      } else {
        seriesApi = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          title: s.label,
        });
      }

      seriesApi.setData(s.data as any);

      if (events?.length && chartType !== "bar") {
        const lastDataDate = s.data.length > 0 ? s.data[s.data.length - 1].time : null;
        const firstDataDate = s.data.length > 0 ? s.data[0].time : null;
        const markers: SeriesMarker<Time>[] = [];

        for (const [date, dateEvents] of eventsByDate) {
          const matching = dateEvents.filter((ev) =>
            ev.tickers.some(
              (t) => t === s.label || t.replace(".L", "") === s.label,
            ),
          );
          if (matching.length === 0) continue;

          // Snap dates outside the series data range to the nearest edge
          let visualDate = date;
          if (lastDataDate && date > lastDataDate) visualDate = lastDataDate;
          else if (firstDataDate && date < firstDataDate) visualDate = firstDataDate;

          const bySentiment = new Map<string, ChartEvent[]>();
          for (const ev of matching) {
            const sent = ev.sentiment ?? "neutral";
            const arr = bySentiment.get(sent) ?? [];
            arr.push(ev);
            bySentiment.set(sent, arr);
          }

          for (const [sentiment, group] of bySentiment) {
            const key = `${date}|${s.label}|${sentiment}`;
            if (placedGroups.has(key)) continue;
            placedGroups.add(key);

            const isPositive = sentiment === "positive";
            const isNegative = sentiment === "negative";

            markers.push({
              time: visualDate as Time,
              position: "aboveBar",
              color: isPositive ? "#22c55e" : isNegative ? "#ef4444" : "#a1a1aa",
              shape: isPositive ? "arrowUp" : isNegative ? "arrowDown" : "circle",
              text: group.length > 1 ? `${group.length}` : "",
            });

            // Register events under the visual date for click resolution
            const existing = clickMap.get(visualDate) ?? [];
            for (const ev of group) {
              if (!existing.some((e) => e.id === ev.id)) existing.push(ev);
            }
            clickMap.set(visualDate, existing);
          }
        }

        if (markers.length > 0) {
          markers.sort((a, b) => (a.time as string).localeCompare(b.time as string));
          createSeriesMarkers(seriesApi, markers);
        }
      }

      seriesRefs.current.push(seriesApi);
    });

    clickMapRef.current = clickMap;
    chart.timeScale().fitContent();
  }, [series, chartType, events, eventsByDate]);

  // ── Click → pin / dismiss card ──────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handler = (param: any) => {
      if (!param.time || !param.point || !events?.length) {
        setPinnedCard(null);
        return;
      }
      const timeStr = param.time as string;
      // Check snapped click map first (handles future-date markers),
      // then fall back to the original eventsByDate for exact matches.
      const matched = clickMapRef.current.get(timeStr) ?? eventsByDate.get(timeStr);
      if (matched?.length) {
        setPinnedCard({ events: matched, x: param.point.x, y: param.point.y });
      } else {
        setPinnedCard(null);
      }
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [events, eventsByDate]);

  const hasData = series.length > 0;
  const yLabel = chartType === "drawdown" ? "Drawdown (%)" : "Growth (%)";

  return (
    <div className="relative w-full rounded-xl">
      {!loading && hasData && (
        <div className="absolute top-2 left-2 z-10 text-[11px] text-muted-foreground font-medium pointer-events-none">
          {yLabel}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full rounded-xl"
        style={{
          visibility: hasData ? "visible" : "hidden",
          position: hasData ? "relative" : "absolute",
        }}
      />

      {loading && <Skeleton className="h-[400px] w-full rounded-xl" />}

      {!loading && !hasData && (
        <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No price data available. Click <strong>Sync Prices</strong> to fetch historical data.
          </p>
        </div>
      )}

      {pinnedCard && (
        <EventPinnedCard
          events={pinnedCard.events}
          x={pinnedCard.x}
          y={pinnedCard.y}
          containerWidth={containerRef.current?.clientWidth ?? 600}
          containerHeight={CHART_HEIGHT}
          onClose={() => setPinnedCard(null)}
        />
      )}
    </div>
  );
}
