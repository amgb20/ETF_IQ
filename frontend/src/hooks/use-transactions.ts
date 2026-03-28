import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Transaction {
  id: string;
  position_id: string;
  type: "buy" | "sell";
  trade_date: string;
  price: number;
  shares: number;
  amount: number;
  notes: string | null;
  created_at: string | null;
  etf_isin: string | null;
  etf_name: string | null;
  ticker_yf: string | null;
  realized_pnl: number | null;
  realized_pnl_pct: number | null;
}

export function useTransactions(portfolioId: string | undefined) {
  return useQuery<Transaction[]>({
    queryKey: ["transactions", portfolioId],
    queryFn: () => apiFetch(`/portfolios/${portfolioId}/transactions`),
    enabled: !!portfolioId,
  });
}

export function useSellPosition(portfolioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      positionId,
      shares,
      price,
      trade_date,
      notes,
    }: {
      positionId: string;
      shares: number;
      price: number;
      trade_date?: string;
      notes?: string;
    }) =>
      apiFetch<Transaction>(
        `/portfolios/${portfolioId}/positions/${positionId}/sell`,
        {
          method: "POST",
          body: JSON.stringify({ shares, price, trade_date, notes }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolios"] });
      qc.invalidateQueries({ queryKey: ["transactions", portfolioId] });
    },
  });
}
