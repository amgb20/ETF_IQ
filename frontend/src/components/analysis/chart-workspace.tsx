import { useState, useMemo } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AnalysisChart } from "@/components/charts/analysis-chart";
import { usePriceSeries } from "@/hooks/use-prices";
import { useEvents, type ChartEvent } from "@/hooks/use-events";
import type { ETFListItem } from "@/hooks/use-etfs";
import { tickerLabel } from "@/lib/constants";

interface Props {
  etfs: ETFListItem[];
  selectedIsins: string[];
  onToggleETF: (isin: string) => void;
  portfolioId?: string;
}

export function ChartWorkspace({ etfs, selectedIsins, onToggleETF, portfolioId }: Props) {
  const [chartType, setChartType] = useState<string>("line");
  const [showEvents, setShowEvents] = useState(false);

  const selectedEtfs = etfs.filter((e) => selectedIsins.includes(e.isin));

  const selectedTickers = selectedEtfs.map(
    (e) => tickerLabel(e.ticker_yf, e.isin),
  );

  const { data: events } = useEvents(
    showEvents ? portfolioId : undefined,
    selectedTickers.length > 0 ? selectedTickers : undefined,
  );

  const seriesQueries = selectedEtfs.map((e) => ({
    etf: e,
    ...usePriceSeries(e.id),
  }));

  const series = useMemo(
    () =>
      seriesQueries
        .filter((q) => q.data?.prices?.length)
        .map((q) => ({
          label: tickerLabel(q.etf.ticker_yf, q.etf.isin),
          data: q.data!.prices.map((p) => ({ time: p.date, value: p.close })),
        })),
    [seriesQueries.map((q) => q.data).join(",")]
  );

  const loading = seriesQueries.some((q) => q.isLoading);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v)}>
          <ToggleGroupItem value="line">Line</ToggleGroupItem>
          <ToggleGroupItem value="bar">Bar</ToggleGroupItem>
          <ToggleGroupItem value="risk-return" disabled>Risk-Return</ToggleGroupItem>
          <ToggleGroupItem value="heatmap" disabled>Heatmap</ToggleGroupItem>
          <ToggleGroupItem value="drawdown" disabled>Drawdown</ToggleGroupItem>
        </ToggleGroup>

        <div className="h-6 w-px bg-border" />

        <span className="text-xs text-muted-foreground mr-1">Events:</span>
        <Button
          variant={showEvents ? "default" : "outline"}
          size="sm"
          onClick={() => setShowEvents((v) => !v)}
        >
          {showEvents ? "ON" : "OFF"}
        </Button>
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
      </div>

      <AnalysisChart
        series={series}
        loading={loading}
        chartType={chartType as any}
        events={showEvents ? events : undefined}
      />
    </div>
  );
}
