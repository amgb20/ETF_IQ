import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioSummaryBar } from "./portfolio-summary-bar";
import { PortfolioCard } from "./portfolio-card";
import { ETFDetailModal } from "./etf-detail-modal";
import type { PositionBrief } from "@/hooks/use-portfolios";
import type { ETFListItem, QuoteData } from "@/hooks/use-etfs";

interface Props {
  positions: PositionBrief[];
  etfs: ETFListItem[];
  selectedIsins: string[];
  onSell: (position: PositionBrief) => void;
}

export function PortfolioTab({
  positions,
  etfs,
  selectedIsins,
  onSell,
}: Props) {
  const [detailIsin, setDetailIsin] = useState<string | null>(null);

  const visiblePositions = useMemo(() => {
    if (selectedIsins.length === 0) return positions;
    return positions.filter((p) => selectedIsins.includes(p.etf_isin));
  }, [positions, selectedIsins]);

  const quoteQueries = useQueries({
    queries: etfs.map((e) => ({
      queryKey: ["etf-quote", e.isin],
      queryFn: () => apiFetch<QuoteData>(`/etfs/${e.isin}/quote`),
      enabled: !!e.isin,
    })),
  });

  const quotesMap = useMemo(() => {
    const map = new Map<string, QuoteData>();
    quoteQueries.forEach((q, i) => {
      if (q.data) map.set(etfs[i].isin, q.data);
    });
    return map;
  }, [quoteQueries, etfs]);

  const loading = quoteQueries.some((q) => q.isLoading);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-6">
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-14 w-48" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No active positions. Add ETFs to your portfolio to see the merged view.
      </p>
    );
  }

  return (
    <div>
      <PortfolioSummaryBar positions={positions} quotes={quotesMap} />

      <div className="divide-y divide-border/40">
        {visiblePositions.map((p) => (
          <PortfolioCard
            key={p.id}
            position={p}
            quote={quotesMap.get(p.etf_isin)}
            onClick={() => setDetailIsin(p.etf_isin)}
            onSell={() => onSell(p)}
          />
        ))}
      </div>

      <ETFDetailModal
        isin={detailIsin}
        open={!!detailIsin}
        onClose={() => setDetailIsin(null)}
      />
    </div>
  );
}
