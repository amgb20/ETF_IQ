import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface ETFListItem {
  id: string;
  isin: string;
  ticker_yf: string | null;
  name: string;
  currency: string | null;
  exchange: string | null;
}

export interface Holding {
  holding_name: string | null;
  holding_isin: string | null;
  holding_ticker: string | null;
  weight: number | null;
}

export interface Allocation {
  allocation_type: string;
  name: string;
  percentage: number | null;
}

export interface ETFDetail extends ETFListItem {
  ter: number | null;
  aum_eur: number | null;
  inception_date: string | null;
  domicile: string | null;
  replication: string | null;
  distribution: string | null;
  description: string | null;
  holdings_count: number | null;
  vol_1y: number | null;
  vol_3y: number | null;
  ret_risk_1y: number | null;
  max_dd_1y: number | null;
  holdings: Holding[];
  allocations: Allocation[];
}

export function useETFs() {
  return useQuery<ETFListItem[]>({
    queryKey: ["etfs"],
    queryFn: () => apiFetch("/etfs"),
  });
}

export function useETFDetail(isin: string | undefined) {
  return useQuery<ETFDetail>({
    queryKey: ["etf", isin],
    queryFn: () => apiFetch(`/etfs/${isin}`),
    enabled: !!isin,
  });
}
