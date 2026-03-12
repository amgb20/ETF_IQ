import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { AnalysisChart } from "@/components/charts/analysis-chart";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useEvents } from "@/hooks/use-events";
import type { ETFListItem } from "@/hooks/use-etfs";
import type { PriceSeries } from "@/hooks/use-prices";
import { tickerLabel } from "@/lib/constants";

interface Props {
  etfs: ETFListItem[];
  selectedIsins: string[];
  onToggleETF: (isin: string) => void;
  portfolioId?: string;
  onAddETF?: () => void;
}

export function ChartWorkspace({ etfs, selectedIsins, onToggleETF, portfolioId, onAddETF }: Props) {
  const [chartType, setChartType] = useState<string>("line");
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

  const series = useMemo(
    () =>
      priceQueries
        .map((q, i) => ({ q, etf: selectedEtfs[i] }))
        .filter(({ q }) => q.data?.prices?.length)
        .map(({ q, etf }) => ({
          label: tickerLabel(etf.ticker_yf, etf.isin),
          data: q.data!.prices.map((p) => ({ time: p.date, value: p.close })),
        })),
    [priceQueries.map((q) => q.dataUpdatedAt).join(","), selectedEtfs],
  );

  const loading = priceQueries.some((q) => q.isLoading);

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
        {onAddETF && (
          <Button variant="outline" size="sm" onClick={onAddETF} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add ETF
          </Button>
        )}
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
