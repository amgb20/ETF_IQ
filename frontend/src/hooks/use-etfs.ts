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
  vol_5y: number | null;
  ret_risk_1y: number | null;
  ret_risk_3y: number | null;
  ret_risk_5y: number | null;
  max_dd_1y: number | null;
  max_dd_3y: number | null;
  max_dd_5y: number | null;
  max_dd_inception: number | null;

  index_name: string | null;
  index_description: string | null;
  investment_focus: string | null;
  legal_structure: string | null;
  strategy_risk: string | null;
  sustainability: string | null;
  fund_currency: string | null;
  currency_risk: string | null;
  distribution_frequency: string | null;
  fund_provider: string | null;
  top10_weight: number | null;
  holdings_in_index: number | null;

  holdings: Holding[];
  allocations: Allocation[];
}

export interface QuoteData {
  isin: string;
  last_close: number | null;
  last_date: string | null;
  previous_close: number | null;
  day_change: number | null;
  day_change_pct: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
}

export interface ETFRiskMetric {
  etf_id: string;
  isin: string;
  ticker_yf: string | null;
  name: string;
  annualized_return: number | null;
  annualized_volatility: number | null;
  max_drawdown: number | null;
  sharpe_ratio: number | null;
}

export interface RiskMetricsData {
  etfs: ETFRiskMetric[];
  correlation: Record<string, Record<string, number>>;
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

export function useETFQuote(isin: string | undefined) {
  return useQuery<QuoteData>({
    queryKey: ["etf-quote", isin],
    queryFn: () => apiFetch(`/etfs/${isin}/quote`),
    enabled: !!isin,
  });
}

export function useRiskMetrics(portfolioId: string | undefined) {
  return useQuery<RiskMetricsData>({
    queryKey: ["risk-metrics", portfolioId],
    queryFn: () => apiFetch(`/analytics/risk-metrics?portfolio_id=${portfolioId}`),
    enabled: !!portfolioId,
  });
}
