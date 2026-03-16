import { useState, useMemo, useEffect } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import {
  subDays, subMonths, subYears, startOfYear,
  format, parseISO, getISOWeek, getISOWeekYear,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { AnalysisChart } from "@/components/charts/analysis-chart";
import { RiskReturnChart } from "@/components/charts/risk-return-chart";
import { CorrelationHeatmap } from "@/components/charts/correlation-heatmap";
import { MonthlyReturnsHeatmap } from "@/components/charts/monthly-returns-heatmap";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useEvents } from "@/hooks/use-events";
import { useRiskMetrics } from "@/hooks/use-etfs";
import type { ETFListItem } from "@/hooks/use-etfs";
import type { PriceSeries, IntradaySeries } from "@/hooks/use-prices";
import { CHART_COLORS, tickerLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ChartMode = "line" | "bar" | "drawdown" | "risk-return" | "correlation" | "heatmap";

type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "MAX";
const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "MAX"];

type DataInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo";

const INTERVALS_FOR_RANGE: Record<TimeRange, DataInterval[]> = {
  "1D":  ["1m", "5m", "15m", "1h"],
  "1W":  ["15m", "1h", "1d"],
  "1M":  ["1d", "1wk"],
  "3M":  ["1d", "1wk", "1mo"],
  "6M":  ["1d", "1wk", "1mo"],
  "YTD": ["1d", "1wk", "1mo"],
  "1Y":  ["1d", "1wk", "1mo"],
  "3Y":  ["1wk", "1mo"],
  "5Y":  ["1wk", "1mo"],
  "MAX": ["1wk", "1mo"],
};

const DEFAULT_INTERVAL: Record<TimeRange, DataInterval> = {
  "1D": "5m", "1W": "1h", "1M": "1d", "3M": "1d",
  "6M": "1d", "YTD": "1d", "1Y": "1d", "3Y": "1wk",
  "5Y": "1wk", "MAX": "1mo",
};

/** yfinance period string for each time range (used by intraday endpoint). */
const PERIOD_FOR_RANGE: Record<TimeRange, string> = {
  "1D": "1d", "1W": "5d", "1M": "1mo", "3M": "3mo",
  "6M": "6mo", "YTD": "ytd", "1Y": "1y", "3Y": "3y",
  "5Y": "5y", "MAX": "max",
};

const INTRADAY_INTERVALS = new Set<DataInterval>(["1m", "5m", "15m", "1h"]);

function computeFromDate(range: TimeRange): string | undefined {
  const now = new Date();
  switch (range) {
    case "1D": return format(subDays(now, 1), "yyyy-MM-dd");
    case "1W": return format(subDays(now, 7), "yyyy-MM-dd");
    case "1M": return format(subMonths(now, 1), "yyyy-MM-dd");
    case "3M": return format(subMonths(now, 3), "yyyy-MM-dd");
    case "6M": return format(subMonths(now, 6), "yyyy-MM-dd");
    case "YTD": return format(startOfYear(now), "yyyy-MM-dd");
    case "1Y": return format(subYears(now, 1), "yyyy-MM-dd");
    case "3Y": return format(subYears(now, 3), "yyyy-MM-dd");
    case "5Y": return format(subYears(now, 5), "yyyy-MM-dd");
    case "MAX": return undefined;
  }
}

function aggregateWeekly(
  prices: { date: string; close: number }[],
): { date: string; close: number }[] {
  if (prices.length === 0) return [];
  const byWeek = new Map<string, { date: string; close: number }>();
  for (const p of prices) {
    const d = parseISO(p.date);
    const key = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
    byWeek.set(key, p);
  }
  return Array.from(byWeek.values());
}

function aggregateMonthly(
  prices: { date: string; close: number }[],
): { date: string; close: number }[] {
  if (prices.length === 0) return [];
  const byMonth = new Map<string, { date: string; close: number }>();
  for (const p of prices) {
    const key = p.date.slice(0, 7); // "YYYY-MM"
    byMonth.set(key, p);
  }
  return Array.from(byMonth.values());
}

interface Props {
  etfs: ETFListItem[];
  selectedIsins: string[];
  onToggleETF: (isin: string) => void;
  portfolioId?: string;
  onAddETF?: () => void;
}

function toPercentGrowth(prices: { date: string; close: number }[]) {
  if (prices.length === 0) return [];
  const base = prices[0].close;
  if (base === 0) return prices.map((p) => ({ time: p.date, value: 0 }));
  return prices.map((p) => ({
    time: p.date,
    value: ((p.close / base) - 1) * 100,
  }));
}

function toDrawdown(prices: { date: string; close: number }[]) {
  if (prices.length === 0) return [];
  let peak = prices[0].close;
  return prices.map((p) => {
    if (p.close > peak) peak = p.close;
    const dd = peak > 0 ? ((p.close / peak) - 1) * 100 : 0;
    return { time: p.date, value: dd };
  });
}

export function ChartWorkspace({ etfs, selectedIsins, onToggleETF, portfolioId, onAddETF }: Props) {
  const [chartType, setChartType] = useState<ChartMode>("line");
  const [showEvents, setShowEvents] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [interval, setInterval] = useState<DataInterval>("1d");

  const isIntraday = INTRADAY_INTERVALS.has(interval);
  const fromDate = useMemo(() => computeFromDate(timeRange), [timeRange]);

  // Reset interval when time range changes
  useEffect(() => {
    setInterval(DEFAULT_INTERVAL[timeRange]);
  }, [timeRange]);

  const selectedEtfs = useMemo(
    () => etfs.filter((e) => selectedIsins.includes(e.isin)),
    [etfs, selectedIsins],
  );

  const selectedTickers = useMemo(
    () => selectedEtfs.map((e) => tickerLabel(e.ticker_yf, e.isin)),
    [selectedEtfs],
  );

  const eventTickers = useMemo(
    () => selectedEtfs.map((e) => e.ticker_yf).filter(Boolean) as string[],
    [selectedEtfs],
  );

  const { data: events } = useEvents(
    showEvents ? portfolioId : undefined,
    eventTickers.length > 0 ? eventTickers : undefined,
    fromDate,
  );

  const { data: riskMetrics, isLoading: riskLoading } = useRiskMetrics(
    (chartType === "risk-return" || chartType === "correlation") ? portfolioId : undefined,
  );

  const priceQueries = useQueries({
    queries: selectedEtfs.map((e) => ({
      queryKey: ["prices", e.id, timeRange, interval],
      queryFn: () => {
        if (isIntraday) {
          const params = new URLSearchParams({
            ticker: e.ticker_yf || e.isin,
            period: PERIOD_FOR_RANGE[timeRange],
            interval,
          });
          return apiFetch<IntradaySeries>(`/prices/intraday?${params.toString()}`);
        }
        const params = new URLSearchParams({ etf_id: e.id });
        if (fromDate) params.set("from", fromDate);
        return apiFetch<PriceSeries>(`/prices?${params.toString()}`);
      },
      enabled: isIntraday ? !!e.ticker_yf : !!e.id,
      staleTime: isIntraday ? 60_000 : 5 * 60_000,
    })),
  });

  const series = useMemo(() => {
    const isDrawdown = chartType === "drawdown";
    return priceQueries
      .map((q, i) => ({ q, etf: selectedEtfs[i] }))
      .filter(({ q }) => {
        if (!q.data) return false;
        if (isIntraday) return (q.data as IntradaySeries).prices?.length > 0;
        return (q.data as PriceSeries).prices?.length > 0;
      })
      .map(({ q, etf }) => {
        let rawPrices: { date: string; close: number }[];
        if (isIntraday) {
          const intradayData = q.data as IntradaySeries;
          rawPrices = intradayData.prices.map((p) => ({
            date: p.timestamp,
            close: p.close,
          }));
        } else {
          let daily = (q.data as PriceSeries).prices.map((p) => ({
            date: p.date,
            close: p.close,
          }));
          if (interval === "1wk") daily = aggregateWeekly(daily);
          if (interval === "1mo") daily = aggregateMonthly(daily);
          rawPrices = daily;
        }
        const transformed = isDrawdown ? toDrawdown(rawPrices) : toPercentGrowth(rawPrices);
        return {
          label: tickerLabel(etf.ticker_yf, etf.isin),
          data: transformed,
        };
      });
  }, [priceQueries.map((q) => q.dataUpdatedAt).join(","), selectedEtfs, chartType, interval, isIntraday]);

  const loading = priceQueries.some((q) => q.isLoading);

  const isTimeSeriesChart = chartType === "line" || chartType === "bar" || chartType === "drawdown";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border-b border-border gap-0">
          {(["line", "bar", "drawdown", "risk-return", "correlation", "heatmap"] as ChartMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setChartType(mode)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors capitalize",
                chartType === mode
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "risk-return" ? "Risk-Return" : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {isTimeSeriesChart && (
          <>
            <div className="h-6 w-px bg-border" />
            <span className="text-xs text-muted-foreground mr-1">Events:</span>
            <Button
              variant={showEvents ? "default" : "outline"}
              size="sm"
              onClick={() => setShowEvents((v) => !v)}
            >
              {showEvents ? "ON" : "OFF"}
            </Button>
          </>
        )}
      </div>

      {isTimeSeriesChart && (
        <div className="flex flex-wrap items-center gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                timeRange === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {r}
            </button>
          ))}
          <div className="h-4 w-px bg-border mx-1" />
          {INTERVALS_FOR_RANGE[timeRange].map((intv) => (
            <button
              key={intv}
              onClick={() => setInterval(intv)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                interval === intv
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {intv}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {etfs.map((etf, idx) => {
          const ticker = tickerLabel(etf.ticker_yf, etf.isin);
          const active = selectedIsins.includes(etf.isin);
          return (
            <Button
              key={etf.isin}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleETF(etf.isin)}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0"
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              {ticker}
            </Button>
          );
        })}
        {onAddETF && (
          <Button variant="outline" size="sm" onClick={onAddETF} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add ETF
          </Button>
        )}
      </div>

      {isTimeSeriesChart && (
        <AnalysisChart
          series={series}
          loading={loading}
          chartType={chartType as "line" | "bar" | "drawdown"}
          events={showEvents ? events : undefined}
          isIntraday={isIntraday}
        />
      )}

      {chartType === "risk-return" && (
        <RiskReturnChart metrics={riskMetrics?.etfs} loading={riskLoading} />
      )}

      {chartType === "correlation" && (
        <CorrelationHeatmap
          correlation={riskMetrics?.correlation}
          etfs={riskMetrics?.etfs}
          loading={riskLoading}
        />
      )}

      {chartType === "heatmap" && (
        <MonthlyReturnsHeatmap
          priceQueries={priceQueries as UseQueryResult<PriceSeries, Error>[]}
          etfs={selectedEtfs}
          loading={loading}
        />
      )}
    </div>
  );
}
