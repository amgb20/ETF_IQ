import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Snapshot {
  id: string;
  portfolio_id: string;
  date: string;
  total_value: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
  allocations: Record<string, number> | null;
}

export interface OverlapData {
  overlap: Record<string, Record<string, string[]>>;
}

export function useSnapshot(portfolioId: string | undefined) {
  return useQuery<Snapshot>({
    queryKey: ["snapshot", portfolioId],
    queryFn: () => apiFetch(`/portfolios/${portfolioId}/snapshot`),
    enabled: !!portfolioId,
    retry: false,
  });
}

export function useOverlap(portfolioId: string | undefined) {
  return useQuery<OverlapData>({
    queryKey: ["overlap", portfolioId],
    queryFn: () => apiFetch(`/portfolios/${portfolioId}/overlap`),
    enabled: !!portfolioId,
    retry: false,
  });
}
