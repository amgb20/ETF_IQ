import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "@/contexts/UserContext";
import { apiFetch } from "@/lib/api-client";

export interface ThemeBrief {
  id: string;
  name: string;
  color: string | null;
  research_agent: string | null;
  sort_order: number;
  position_count: number;
}

export interface PositionBrief {
  id: string;
  etf_id: string;
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
  theme_color: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  positions: PositionBrief[];
  themes: ThemeBrief[];
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

export function usePortfolioThemes(portfolioId: string | undefined) {
  return useQuery<ThemeBrief[]>({
    queryKey: ["portfolio-themes", portfolioId],
    queryFn: () => apiFetch(`/portfolios/${portfolioId}/themes`),
    enabled: !!portfolioId,
  });
}

export function useCreateTheme(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation<ThemeBrief, Error, { name: string; color?: string }>({
    mutationFn: (data) =>
      apiFetch(`/portfolios/${portfolioId}/themes`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-themes", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
    },
  });
}

export function useUpdateTheme(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation<ThemeBrief, Error, { themeId: string; name?: string; color?: string }>({
    mutationFn: ({ themeId, ...data }) =>
      apiFetch(`/portfolios/${portfolioId}/themes/${themeId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-themes", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
    },
  });
}

export function useDeleteTheme(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (themeId) =>
      apiFetch(`/portfolios/${portfolioId}/themes/${themeId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-themes", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
    },
  });
}

export function useReassignPositionTheme(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { positionId: string; themeId: string | null }>({
    mutationFn: ({ positionId, themeId }) =>
      apiFetch(`/portfolios/${portfolioId}/positions/${positionId}/theme`, {
        method: "PUT",
        body: JSON.stringify({ theme_id: themeId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
    },
  });
}
