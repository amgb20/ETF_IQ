import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AlertEvent {
  id: string;
  alert_id: string;
  triggered_at: string | null;
  actual_value: number | null;
  message: string | null;
}

export interface Alert {
  id: string;
  portfolio_id: string;
  type: string;
  etf_id: string | null;
  threshold: number;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string | null;
  events: AlertEvent[];
}

export function useAlerts(portfolioId: string | undefined) {
  const params = new URLSearchParams();
  if (portfolioId) params.set("portfolio_id", portfolioId);

  return useQuery<Alert[]>({
    queryKey: ["alerts", portfolioId],
    queryFn: () => apiFetch(`/alerts?${params.toString()}`),
    enabled: !!portfolioId,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      portfolio_id: string;
      etf_id: string;
      type: string;
      threshold: number;
    }) =>
      apiFetch<Alert>("/alerts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      threshold?: number;
      is_active?: boolean;
    }) =>
      apiFetch<Alert>(`/alerts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/alerts/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["alerts"] });
      const previous = qc.getQueriesData<Alert[]>({ queryKey: ["alerts"] });
      qc.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (old) =>
        old?.filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
