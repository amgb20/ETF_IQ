import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface AppNotification {
  id: string;
  user_id: string;
  type: "report_ready" | "alert_configured" | "alert_triggered";
  title: string;
  message: string | null;
  is_read: boolean;
  ref_id: string | null;
  created_at: string | null;
}

export function useNotifications() {
  return useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/notifications"),
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
