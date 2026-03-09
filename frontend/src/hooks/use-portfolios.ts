import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { apiFetch } from "@/lib/api-client";

export interface PositionBrief {
  id: string;
  etf_isin: string;
  etf_name: string;
  ticker_yf: string | null;
  shares: number;
  entry_price: number;
  entry_date: string;
  invested_amount: number;
  current_price: number | null;
  current_value: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  target_allocation: number | null;
  theme_name: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  positions: PositionBrief[];
  total_value: number | null;
  total_pnl: number | null;
  total_pnl_pct: number | null;
}

export function usePortfolios() {
  const { isAuthenticated } = useUserContext();
  return useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: () => apiFetch("/portfolios"),
    enabled: isAuthenticated,
  });
}

export function usePortfolio(id: string | undefined) {
  return useQuery<Portfolio>({
    queryKey: ["portfolio", id],
    queryFn: () => apiFetch(`/portfolios/${id}`),
    enabled: !!id,
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<Portfolio>("/portfolios", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}
