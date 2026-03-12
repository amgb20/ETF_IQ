import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import type { PriceSeries } from "@/hooks/use-prices";
import { tickerLabel } from "@/lib/constants";

export type ChartMode = "line" | "bar" | "drawdown" | "risk-return" | "correlation" | "heatmap";

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

  const selectedEtfs = useMemo(
    () => etfs.filter((e) => selectedIsins.includes(e.isin)),
    [etfs, selectedIsins],
  );

  const selectedTickers = useMemo(
    () => selectedEtfs.map((e) => tickerLabel(e.ticker_yf, e.isin)),
    [selectedEtfs],
  );

  const { data: events } = useEvents(
    showEvents ? portfolioId : undefined,
    selectedTickers.length > 0 ? selectedTickers : undefined,
  );

  const { data: riskMetrics, isLoading: riskLoading } = useRiskMetrics(
    (chartType === "risk-return" || chartType === "correlation") ? portfolioId : undefined,
  );

  const priceQueries = useQueries({
    queries: selectedEtfs.map((e) => ({
      queryKey: ["prices", e.id, undefined, undefined],
      queryFn: () => {
        const params = new URLSearchParams();
        params.set("etf_id", e.id);
        return apiFetch<PriceSeries>(`/prices?${params.toString()}`);
      },
      enabled: !!e.id,
    })),
  });

  const series = useMemo(() => {
    const isDrawdown = chartType === "drawdown";
    return priceQueries
      .map((q, i) => ({ q, etf: selectedEtfs[i] }))
      .filter(({ q }) => q.data?.prices?.length)
      .map(({ q, etf }) => {
        const rawPrices = q.data!.prices.map((p) => ({ date: p.date, close: p.close }));
        const transformed = isDrawdown ? toDrawdown(rawPrices) : toPercentGrowth(rawPrices);
        return {
          label: tickerLabel(etf.ticker_yf, etf.isin),
          data: transformed,
        };
      });
  }, [priceQueries.map((q) => q.dataUpdatedAt).join(","), selectedEtfs, chartType]);

  const loading = priceQueries.some((q) => q.isLoading);

  const isTimeSeriesChart = chartType === "line" || chartType === "bar" || chartType === "drawdown";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as ChartMode)}>
          <ToggleGroupItem value="line">Line</ToggleGroupItem>
          <ToggleGroupItem value="bar">Bar</ToggleGroupItem>
          <ToggleGroupItem value="drawdown">Drawdown</ToggleGroupItem>
          <ToggleGroupItem value="risk-return">Risk-Return</ToggleGroupItem>
          <ToggleGroupItem value="correlation">Correlation</ToggleGroupItem>
          <ToggleGroupItem value="heatmap">Heatmap</ToggleGroupItem>
        </ToggleGroup>

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

      <div className="flex flex-wrap gap-2">
        {etfs.map((etf) => {
          const ticker = tickerLabel(etf.ticker_yf, etf.isin);
          const active = selectedIsins.includes(etf.isin);
          return (
            <Button
              key={etf.isin}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleETF(etf.isin)}
            >
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
          priceQueries={priceQueries}
          etfs={selectedEtfs}
          loading={loading}
        />
      )}
    </div>
  );
}
