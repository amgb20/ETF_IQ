import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ChartEvent {
  id: string;
  portfolio_id: string;
  agent_output_id: string | null;
  event_date: string;
  headline: string;
  description: string | null;
  source_url: string | null;
  tickers: string[];
  themes: string[] | null;
  sentiment: string | null;
  importance: number | null;
  source_agent: string | null;
  created_at: string | null;
}

export function useEvents(
  portfolioId: string | undefined,
  tickers?: string[],
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams();
  if (portfolioId) params.set("portfolio_id", portfolioId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (tickers?.length) {
    tickers.forEach((t) => params.append("tickers", t));
  }

  return useQuery<ChartEvent[]>({
    queryKey: ["events", portfolioId, tickers, from, to],
    queryFn: () => apiFetch(`/events?${params.toString()}`),
    enabled: !!portfolioId,
  });
}
