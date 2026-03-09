import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface PriceRow {
  etf_id: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface PriceSeries {
  etf_id: string;
  prices: PriceRow[];
}

export function usePriceSeries(etfId: string | undefined, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (etfId) params.set("etf_id", etfId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return useQuery<PriceSeries>({
    queryKey: ["prices", etfId, from, to],
    queryFn: () => apiFetch(`/prices?${params.toString()}`),
    enabled: !!etfId,
  });
}
