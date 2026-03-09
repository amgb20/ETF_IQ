import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface AddPositionData {
  etf_id: string;
  shares: number;
  entry_price: number;
  entry_date: string;
  invested_amount: number;
  theme_id?: string;
  target_allocation?: number;
  layer_label?: string;
}

export function useAddPosition(portfolioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddPositionData) =>
      apiFetch(`/portfolios/${portfolioId}/positions`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] }),
  });
}
